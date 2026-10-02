import random

from django.http import Http404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.exceptions import PermissionDenied

from proteins.models import Protein
from core.models import UserInteractionNetwork
from .models import (
    InteractionCategory,
    InteractionNetwork,
    InteractionInteractionNetworks,
)
from .search_service import execute_search, build_result_from_interaction_ids
from .serializers import SaveNetworkInputSerializer, SavedNetworkListSerializer


class InteractionCategoryListView(APIView):
    """Return all InteractionCategory rows ordered by their 'order' field."""

    permission_classes = [AllowAny]

    def get(self, request):
        categories = sorted(
            InteractionCategory.objects.all(), key=InteractionCategory.sort_key
        )
        data = [
            {"id": cat.id, "category_name": cat.category_name, "order": cat.order}
            for cat in categories
        ]
        return Response(data)


class SearchView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        q = request.query_params.get("q", "")
        filter_parameter = request.query_params.get("filter", "None")
        result = execute_search(q=q, filter_parameter=filter_parameter)
        return Response(result)


class SearchInteractorsView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        search_term = request.data.get("searchTerm", "")
        filter_parameter = request.data.get("filterParameter", "None")
        if filter_parameter == "query_interactor":
            filter_parameter = "query_query"
        result = execute_search(q=search_term, filter_parameter=filter_parameter)
        return Response(result)


class HomeNetworkView(APIView):
    """Return a random protein's interaction network for the home page preview."""

    permission_classes = [AllowAny]

    def get(self, request):
        # Sample 50 candidates, pick one at random — mirrors legacy getrandomprotein()
        candidates = list(
            Protein.objects.filter(number_of_interactions_in_database__gt=0)
            .values_list("gene_name", flat=True)
            .exclude(gene_name__isnull=True)
            .exclude(gene_name="")
            .order_by("?")[:50]
        )
        if not candidates:
            return Response(
                {
                    "all_proteins": [],
                    "all_interactions": [],
                    "query_protein_id_array": [],
                }
            )

        gene = random.choice(candidates)
        result = execute_search(q=gene, filter_parameter="None")
        return Response(result)


class SavedNetworkListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        network_ids = UserInteractionNetwork.objects.filter(
            user=request.user
        ).values_list("interaction_network_id", flat=True)
        networks = InteractionNetwork.objects.filter(id__in=network_ids).order_by("-id")
        serializer = SavedNetworkListSerializer(networks, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = SaveNetworkInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        network = InteractionNetwork.objects.create(
            name=data["name"],
            query=data["query"][:100],
            interactor_query_string=data["query"],
            score_parameter=data["score_parameter"],
            category_array=data["category_array"],
            tissue_expression_array=data.get("tissue_expression_array", ""),
        )
        InteractionInteractionNetworks.objects.bulk_create(
            [
                InteractionInteractionNetworks(
                    interaction_network=network,
                    interaction_id=iid,
                )
                for iid in data["interaction_ids"]
            ]
        )
        UserInteractionNetwork.objects.create(
            user=request.user,
            interaction_network=network,
        )
        return Response(
            {
                "id": network.id,
                "name": network.name,
                "interaction_count": len(data["interaction_ids"]),
            },
            status=201,
        )


class SavedNetworkDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_owned_network(self, request, pk: int) -> InteractionNetwork:
        try:
            network = InteractionNetwork.objects.get(pk=pk)
        except InteractionNetwork.DoesNotExist:
            raise Http404
        if not UserInteractionNetwork.objects.filter(
            user=request.user, interaction_network=network
        ).exists():
            raise PermissionDenied
        return network

    def get(self, request, pk: int):
        network = self._get_owned_network(request, pk)
        interaction_ids = list(
            network.network_interactions.values_list("interaction_id", flat=True)
        )
        query = network.interactor_query_string or network.query or ""
        result = build_result_from_interaction_ids(interaction_ids, query)
        return Response(
            {
                "id": network.id,
                "name": network.name,
                "query": query,
                "score_parameter": network.score_parameter,
                "category_array": network.category_array,
                "tissue_expression_array": network.tissue_expression_array or "",
                **result,
            }
        )

    def delete(self, request, pk: int):
        network = self._get_owned_network(request, pk)
        network.delete()
        return Response(status=204)
