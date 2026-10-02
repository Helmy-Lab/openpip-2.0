"""
MIQL (Molecular Interaction Query Language) parser.

MIQL is the search syntax PSICQUIC services accept, so the same query string
works against openPIP, IntAct, BioGRID and the rest. That is the whole point of
it, and the reason this parser refuses what it cannot answer rather than
guessing: a client asking every service the same question must be able to tell
"openPIP cannot answer that" from "openPIP holds none".

Fields:
  BRCA1               plain text — gene name or UniProt ID, either interactor
  idA:P38398          interactor A by identifier
  idB:P38398          interactor B by identifier
  id:P38398           either interactor
  taxidA:9606         taxon of interactor A
  taxidB:9606         taxon of interactor B
  species:9606        taxon of either interactor
  pubid:24153252      PubMed ID of a source dataset
  pubauth:Rolland     first author of a source dataset
  *                   everything

Operators:
  AND OR NOT          and parentheses, e.g. idA:BRCA1 AND NOT species:10090
  a b                 adjacency means AND

Adding a field means one entry in FIELD_HANDLERS. It must be there rather than
in a branch below the unsupported-field check, or the field is advertised in the
error message and rejected by it — which happened once; see
test_every_advertised_field_is_actually_answerable.

Not implemented: detmethod, type, and the participant fields (pbiorole, ptype,
pmethod, stc, ftype). The first two are derived at render time rather than
stored, so querying them would mean duplicating the formatter's inference and
keeping the two in step. The participant fields are stored but populate only on
upload, so today they would answer 0 for every interaction — truthful, and
exactly as unhelpful as the zeros this parser exists to avoid.
"""

import re

from django.db.models import Q, QuerySet

from interactions.models import Interaction


class UnsupportedQuery(ValueError):
    """Raised for valid MIQL this parser cannot answer.

    The alternative is worse than it looks. Before this existed, a query like
    `species:9606` fell through to the plain-text branch, matched no protein
    named "species:9606", and returned zero — a confident, 200-status "there are
    none" to a question about the 122,933 human interactions openPIP holds.
    `detmethod:"two hybrid"` likewise reported none of roughly 80,000.

    A client federating across PSICQUIC services cannot tell that kind of zero
    from a real one, so it records openPIP as having no human data and no
    two-hybrid data. Refusing the query is the difference between "we cannot
    answer that" and "the answer is none".
    """


def _proteins_matching(term: str):
    """Return protein PKs matching a gene name or UniProt/Entrez ID."""
    from proteins.models import Protein

    return Protein.objects.filter(
        Q(gene_name__iexact=term)
        | Q(uniprot_id__iexact=term)
        | Q(entrez_id__iexact=term)
        | Q(protein_identifiers__identifier__identifier__iexact=term)
    ).values_list("pk", flat=True)


def _proteins_by_taxon(taxon_id: str):
    """Return protein PKs for a given NCBI taxonomy ID."""
    from proteins.models import Protein

    return Protein.objects.filter(
        protein_organisms__organism__taxonomy_id=taxon_id
    ).values_list("pk", flat=True)


def _either_interactor(pks) -> Q:
    return Q(interactor_A__in=pks) | Q(interactor_B__in=pks)


# Every field openPIP answers, and how. One entry per field: the registry is
# what keeps SUPPORTED_FIELDS, the error message and the parser from disagreeing.
FIELD_HANDLERS = {
    "ida": lambda v: Q(interactor_A__in=_proteins_matching(v)),
    "idb": lambda v: Q(interactor_B__in=_proteins_matching(v)),
    "id": lambda v: _either_interactor(_proteins_matching(v)),
    "taxida": lambda v: Q(interactor_A__in=_proteins_by_taxon(v)),
    "taxidb": lambda v: Q(interactor_B__in=_proteins_by_taxon(v)),
    "species": lambda v: _either_interactor(_proteins_by_taxon(v)),
    "pubid": lambda v: Q(interaction_datasets__dataset__pubmed_id__iexact=v),
    "pubauth": lambda v: Q(interaction_datasets__dataset__author__icontains=v),
}

SUPPORTED_FIELDS = (
    "idA",
    "idB",
    "id",
    "taxidA",
    "taxidB",
    "species",
    "pubid",
    "pubauth",
)

# field:value, a quoted phrase, a parenthesis, an operator, or a bare word.
_TOKEN = re.compile(
    r"""\s*(?:
        (?P<lparen>\()
      | (?P<rparen>\))
      | (?P<field>[A-Za-z_]+):(?:"(?P<qvalue>[^"]*)"|(?P<value>[^\s()]+))
      | "(?P<phrase>[^"]*)"
      | (?P<word>[^\s()]+)
    )""",
    re.VERBOSE,
)
_OPERATORS = {"and", "or", "not"}


def _tokenize(query: str) -> list[tuple[str, str]]:
    """(kind, value) pairs. Raises on anything the pattern cannot consume."""
    tokens, pos = [], 0
    while pos < len(query):
        if query[pos].isspace():
            pos += 1
            continue
        match = _TOKEN.match(query, pos)
        if not match:
            raise UnsupportedQuery(f"Could not parse query near: {query[pos:][:20]}")
        pos = match.end()
        if match.group("lparen"):
            tokens.append(("lparen", "("))
        elif match.group("rparen"):
            tokens.append(("rparen", ")"))
        elif match.group("field"):
            value = match.group("qvalue")
            if value is None:
                value = match.group("value")
            tokens.append(("field", (match.group("field"), value)))
        elif match.group("phrase") is not None:
            tokens.append(("term", match.group("phrase")))
        else:
            word = match.group("word")
            kind = "op" if word.lower() in _OPERATORS else "term"
            tokens.append((kind, word.lower() if kind == "op" else word))
    return tokens


class _Parser:
    """Recursive descent over the token list.

    Grammar, loosest binding first:
        expression := conjunction (OR conjunction)*
        conjunction := unary (AND? unary)*      -- adjacency means AND
        unary := NOT unary | "(" expression ")" | clause
    """

    def __init__(self, tokens):
        self.tokens = tokens
        self.pos = 0

    def peek(self):
        return self.tokens[self.pos] if self.pos < len(self.tokens) else (None, None)

    def parse(self) -> Q:
        node = self.expression()
        if self.pos != len(self.tokens):
            raise UnsupportedQuery("Unbalanced parentheses in query.")
        return node

    def expression(self) -> Q:
        node = self.conjunction()
        while self.peek() == ("op", "or"):
            self.pos += 1
            node |= self.conjunction()
        return node

    def conjunction(self) -> Q:
        node = self.unary()
        while True:
            kind, value = self.peek()
            if kind == "op" and value == "and":
                self.pos += 1
            elif kind in ("field", "term", "lparen") or (
                kind == "op" and value == "not"
            ):
                pass  # adjacency binds as AND
            else:
                return node
            node &= self.unary()

    def unary(self) -> Q:
        kind, value = self.peek()
        if kind == "op" and value == "not":
            self.pos += 1
            return ~self.unary()
        if kind == "lparen":
            self.pos += 1
            node = self.expression()
            if self.peek()[0] != "rparen":
                raise UnsupportedQuery("Unbalanced parentheses in query.")
            self.pos += 1
            return node
        if kind == "field":
            self.pos += 1
            return _clause(*value)
        if kind == "term":
            self.pos += 1
            return _either_interactor(_proteins_matching(value))
        raise UnsupportedQuery("Query ended unexpectedly.")


def _clause(field: str, value: str) -> Q:
    handler = FIELD_HANDLERS.get(field.lower())
    if handler is None:
        raise UnsupportedQuery(
            f"Unsupported query field: {field}. "
            f"Supported fields: {', '.join(SUPPORTED_FIELDS)}."
        )
    return handler(value)


def parse_miql(query: str) -> QuerySet:
    """Translate a MIQL query string into an Interaction queryset."""
    # Ordered, so firstResult pages neither skip nor repeat rows.
    base = Interaction.objects.filter(removed="0").order_by("pk")
    q = query.strip()

    if not q or q == "*":
        return base

    tokens = _tokenize(q)
    if not tokens:
        return base

    # A joined filter can return the same interaction once per matching dataset.
    return base.filter(_Parser(tokens).parse()).distinct()
