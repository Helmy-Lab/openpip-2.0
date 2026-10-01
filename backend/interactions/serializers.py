from rest_framework import serializers
from .models import InteractionNetwork


class SaveNetworkInputSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100)
    # Stored whole in interactor_query_string (3000); the legacy query column is
    # only 100, which a list of ~15 genes already overflows.
    query = serializers.CharField(max_length=3000)
    score_parameter = serializers.CharField(max_length=100, default="0.00")
    category_array = serializers.CharField(max_length=100, allow_blank=True, default="")
    tissue_expression_array = serializers.CharField(
        max_length=100, allow_blank=True, default=""
    )
    interaction_ids = serializers.ListField(
        child=serializers.IntegerField(), allow_empty=False
    )


class SavedNetworkListSerializer(serializers.ModelSerializer):
    interaction_count = serializers.SerializerMethodField()
    query = serializers.SerializerMethodField()

    def get_query(self, obj):
        return obj.interactor_query_string or obj.query

    def get_interaction_count(self, obj):
        return obj.network_interactions.count()

    class Meta:
        model = InteractionNetwork
        fields = ["id", "name", "query", "interaction_count", "created_at"]
