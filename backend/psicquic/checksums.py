"""ROGID and RIGID checksums for PSI-MI TAB columns 33-35.

A checksum lets another database recognise "this is the same protein" without
agreeing on an accession — it is computed from the sequence itself, so it
survives accession changes, isoform suffixes and database boundaries. That makes
these the columns with the most interoperability value per byte, and the reason
they are worth computing rather than leaving as "-".

The algorithms are iRefIndex's, and neither is written down anywhere openPIP
can cite with confidence. They were instead recovered by reproducing real values
from IntAct's live PSICQUIC service, which is a stronger check than a
specification would have been: the implementations agree on actual production
data, not on a reading of prose.

    ROGID = base64(sha1(sequence)) with padding stripped, then the taxid
    RIGID = base64(sha1(the two ROGIDs concatenated in sorted order))

Verified against IntAct rows for the Xenopus BRCA1/BARD1 interaction:

    Q90X96 (taxid 8355) -> qTAy1sxHTW+SKIMXLD7bs12UlJ08355
    Q90X95 (taxid 8355) -> Gmo+4H4eIXSGCDVPd4KAylEi6Go8355
    the interaction     -> qzJI0Tw7dNsnOu+stz8R6cFNYGY

Those three values are pinned in the tests. If a refactor breaks the algorithm
the tests fail against real-world data, not against our own assumptions — which
matters, because a subtly wrong checksum is worse than none: it looks
authoritative and matches nothing.

Note the asymmetry with the rest of the formatter. Everything else openPIP emits
is either recorded or inferred; these are *computed*, so they are correct by
construction whenever the inputs are right. The inputs are the sequence and the
taxid, both of which openPIP holds only for some proteins — hence the None
returns rather than a fabricated value.
"""

import base64
import hashlib


def _b64_sha1(text: str) -> str:
    digest = hashlib.sha1(text.encode()).digest()
    return base64.b64encode(digest).decode().rstrip("=")


def rogid(sequence: str | None, taxonomy_id: str | None) -> str | None:
    """The protein's ROGID, or None when we lack the sequence or the taxid.

    Both inputs are required: the same sequence in two organisms is two
    different ROGIDs, which is the point of appending the taxid.
    """
    if not sequence or not taxonomy_id:
        return None
    cleaned = "".join(sequence.split()).upper()
    if not cleaned:
        return None
    return _b64_sha1(cleaned) + str(taxonomy_id).strip()


def rigid(rogid_a: str | None, rogid_b: str | None) -> str | None:
    """The interaction's RIGID, or None if either participant lacks a ROGID.

    Sorting is what makes the value independent of which protein was written
    first, so A-B and B-A produce the same interaction checksum.
    """
    if not rogid_a or not rogid_b:
        return None
    return _b64_sha1("".join(sorted([rogid_a, rogid_b])))
