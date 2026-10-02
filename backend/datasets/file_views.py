import os
import uuid

from django.conf import settings
from django.http import Http404, StreamingHttpResponse
from rest_framework import serializers, status
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import UploadFiles
from .views import as_bool

ALLOWED_EXTENSIONS = {".fasta", ".fa", ".tab", ".tsv", ".sif", ".csv"}
MAX_UPLOAD_BYTES = getattr(settings, "FILE_MANAGER_MAX_UPLOAD_MB", 500) * 1024 * 1024


def upload_dir() -> str:
    """Resolve the upload directory at call time.

    Binding this to a module-level constant froze it to whatever MEDIA_ROOT
    held at import, so anything that overrides MEDIA_ROOT afterwards — tests
    pointing at a tmp dir, a management command, a settings reload — was
    silently written into the real media directory instead.
    """
    return os.path.join(settings.MEDIA_ROOT, "uploads")


def _ext(filename: str) -> str:
    return os.path.splitext(filename)[1].lower()


def _is_valid_text_file(data: bytes) -> bool:
    try:
        data[:4096].decode("utf-8")
        return True
    except UnicodeDecodeError:
        return False


class UploadFilesSerializer(serializers.ModelSerializer):
    class Meta:
        model = UploadFiles
        fields = ["id", "file_name", "file_size", "show", "uploaded_at"]


class FileListView(APIView):
    permission_classes = [IsAdminUser]
    parser_classes = [MultiPartParser]

    def get(self, request):
        files = UploadFiles.objects.all().order_by("-uploaded_at")
        return Response(UploadFilesSerializer(files, many=True).data)

    def post(self, request):
        uploaded = request.FILES.get("file")
        if not uploaded:
            return Response(
                {"detail": "No file provided."}, status=status.HTTP_400_BAD_REQUEST
            )

        if uploaded.size > MAX_UPLOAD_BYTES:
            limit_mb = MAX_UPLOAD_BYTES // (1024 * 1024)
            return Response(
                {"detail": f"File exceeds {limit_mb} MB limit."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ext = _ext(uploaded.name)
        if ext not in ALLOWED_EXTENSIONS:
            return Response(
                {
                    "detail": f"File type '{ext}' not allowed. Accepted: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        first_chunk = uploaded.read(4096)
        uploaded.seek(0)
        if not _is_valid_text_file(first_chunk):
            return Response(
                {"detail": "File does not appear to be valid UTF-8 text."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        force = as_bool(request.data.get("force", False))
        original_name = uploaded.name
        disk_name = original_name

        collision = UploadFiles.objects.filter(file_name=original_name).exists()
        if collision and not force:
            return Response(
                {"detail": "collision", "file_name": original_name},
                status=status.HTTP_409_CONFLICT,
            )
        if collision and force:
            prefix = uuid.uuid4().hex[:8]
            disk_name = f"{prefix}_{original_name}"

        target_dir = upload_dir()
        os.makedirs(target_dir, exist_ok=True)
        dest_path = os.path.join(target_dir, disk_name)
        with open(dest_path, "wb") as f:
            for chunk in uploaded.chunks():
                f.write(chunk)

        record = UploadFiles.objects.create(
            file_name=original_name,
            file_path=dest_path,
            file_size=uploaded.size,
            show=True,
        )
        return Response(
            UploadFilesSerializer(record).data, status=status.HTTP_201_CREATED
        )


class FileDetailView(APIView):
    permission_classes = [IsAdminUser]

    def patch(self, request, pk):
        try:
            record = UploadFiles.objects.get(pk=pk)
        except UploadFiles.DoesNotExist:
            raise Http404
        show = request.data.get("show")
        if show is not None:
            record.show = as_bool(show)
            record.save(update_fields=["show"])
        return Response(UploadFilesSerializer(record).data)

    def delete(self, request, pk):
        try:
            record = UploadFiles.objects.get(pk=pk)
        except UploadFiles.DoesNotExist:
            raise Http404
        if record.file_path and os.path.exists(record.file_path):
            os.remove(record.file_path)
        record.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class FileDownloadView(APIView):
    # Public files are free to download without an account; non-public files
    # (show=False) remain restricted to staff via the check below.
    permission_classes = [AllowAny]

    def get(self, request, pk):
        try:
            record = UploadFiles.objects.get(pk=pk)
        except UploadFiles.DoesNotExist:
            raise Http404

        if not record.show and not request.user.is_staff:
            return Response({"detail": "Not found."}, status=status.HTTP_403_FORBIDDEN)

        if not record.file_path or not os.path.exists(record.file_path):
            raise Http404

        def stream():
            with open(record.file_path, "rb") as f:
                while chunk := f.read(8192):
                    yield chunk

        response = StreamingHttpResponse(
            stream(), content_type="application/octet-stream"
        )
        response["Content-Disposition"] = f'attachment; filename="{record.file_name}"'
        response["Content-Length"] = record.file_size
        return response


class PublicFileListView(APIView):
    """Returns show=True files for the Downloads page."""

    permission_classes = [AllowAny]

    def get(self, request):
        files = UploadFiles.objects.filter(show=True).order_by("-uploaded_at")
        return Response(UploadFilesSerializer(files, many=True).data)
