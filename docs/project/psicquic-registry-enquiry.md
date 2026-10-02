# Draft enquiry to the PSICQUIC registry maintainers (EBI)

**Status:** draft, not sent. For Dr. Helmy to send or adapt.
**Purpose:** settle whether openPIP can be listed in the PSICQUIC registry
without a SOAP endpoint, before we decide whether to build one.

**Why it matters:** every one of the 34 currently registered services publishes
a `soapUrl`; none is REST-only. If SOAP is required we need to add it, which
means a WSDL and a SOAP stack in a Django application — a sizeable piece of
work for a protocol we would otherwise never implement. If it is optional, we
can submit as we are. We would rather ask than guess wrong in either direction.

---

**Subject:** Registering a REST-only PSICQUIC service — is a SOAP endpoint required?

Dear PSICQUIC maintainers,

We maintain openPIP, an open-source platform for hosting, visualising and
analysing protein interaction data (Helmy et al., *J Mol Biol* 434, 167603,
2022). It is designed so that a lab or consortium can deploy its own portal for
a dataset it has produced. We are preparing to register our reference
deployment, which currently serves 122,933 human binary protein interactions:

- REST endpoint: `https://openpip.usask.ca/v2/psicquic/rest/`
- Example query: `https://openpip.usask.ca/v2/psicquic/rest/query?q=brca1`
- Supported formats: `tab25`, `tab26`, `tab27`, `tab28`, `count` (plus a
  non-standard `json` for browser clients)
- `/formats` and `/version` are implemented

We have two questions before submitting.

**1. Is a SOAP endpoint required for a registry listing?** We implement the
REST interface only. We notice that all currently registered services publish a
`soapUrl`, which suggests it may be expected, but we could not tell from the
documentation whether it is mandatory or simply universal because most services
run the reference implementation. openPIP is a Django application rather than a
deployment of `psicquic-ws`, so SOAP would be a deliberate addition on our part
and we would like to know whether it is necessary before building it.

**2. What should we supply for the service tags?** Registry entries carry
PSI-MI CV tags (`MI:1047`, `MI:1051` and similar). We would appreciate a
pointer to how these should be chosen, and whether we should first request an
openPIP identifier in the PSI-MI controlled vocabulary — at present our MITAB
source database column reports a local identifier rather than a registered
MI accession, which we would like to correct.

Any guidance on the submission process generally would be very welcome.

With thanks,

*[name, affiliation]*

---

## Notes for us, not for sending

- The count and formats above were verified against the live deployment on
  2026-08-16. Re-check before sending if time has passed.
- Question 2 matters beyond the registry: an official MI accession replaces the
  improvised `openPIP:openPIP` in MITAB column 13 for every row we serve.
- If the answer to (1) is "required", the SOAP surface is small — `getByQuery`,
  `getVersion`, `getSupportedReturnTypes` — but Django has no SOAP support, so
  it would mean adding a library and a WSDL.
