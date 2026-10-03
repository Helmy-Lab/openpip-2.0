# openPIP

**openPIP** (Open-source Protein Interaction Platform) is a web portal for
hosting, searching and visualising protein–protein interaction data. A
research group runs it alongside a published interactome map, so readers can
look up the proteins they care about, explore their interaction networks and
download the data, without the group writing any code. openPIP powers the
portals of the Human and Yeast Reference Interactome maps (HuRI and YeRI).

This repository is **openPIP 2.0**, a rebuild of the
[original platform](https://github.com/BaderLab/openPIP) on Django,
PostgreSQL and React.

**Reference portal:** <https://openpip.usask.ca> (the Human Reference
Interactome) · **Documentation:** <https://openpip.usask.ca/docs/>

## Features

- **Search** by gene name or identifier, one protein or a whole list, and get
  the interaction network back as an interactive graph and as tables.
- **Explore the network**: filter by confidence score, evidence category,
  tissue and annotation; switch layouts; highlight proteins; open any protein or
  interaction for its details, external links and 3D structure.
- **Download** whole datasets (PSI-MI TAB with the dataset's citation, SIF,
  CSV) or the results of a search.
- **Keep and share**: save views, share them with colleagues, discuss them, or
  publish a link that needs no login.
- **Standard access for programs**: a JSON REST API and a
  [PSICQUIC](https://psicquic.github.io/) service that answers MIQL queries in
  PSI-MI TAB 2.5–2.8.
- **Run it without code**: an admin panel to load datasets (PSI-MI TAB or CSV,
  with automatic UniProt enrichment), edit citations, and change the portal's
  name, logo, colours and every piece of text.

## Running a portal

openPIP runs as a set of Docker containers. The
[installation guide](https://openpip.usask.ca/docs/operator-guide/installation/)
covers configuration, HTTPS and the first administrator. In short:

```bash
git clone https://github.com/Helmy-Lab/openpip-2.0.git
cd openpip-2.0
cp .env.example .env    # then set SECRET_KEY, DB_PASSWORD and PUBLIC_URL
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile prod up -d --build
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec backend python manage.py createsuperuser
```

`PUBLIC_URL` is your portal's address, such as `https://openpip.example.org`.
Leave it empty to try openPIP on your own computer at `http://localhost:8080`.
Production needs both compose files. Do not run plain `docker compose up` on
a production server.

## Developing

Requirements: Docker with Compose 2.24.4+, and Node.js 20.19+ (or 22.12+).

```bash
docker compose up -d            # Postgres, Redis, the API (dev settings, port 8001) and the worker
cd frontend
npm ci
npm run dev                     # web interface on http://localhost:5173
```

The development backend reloads when you edit files in `backend/`, and the
Vite dev server forwards `/api` to it. The database starts empty: create an
administrator with `docker compose exec backend python manage.py createsuperuser`,
then load a dataset from **Admin → Datasets**.

See [CONTRIBUTING.md](CONTRIBUTING.md) for running the tests, linters and the
documentation site.

| | |
|---|---|
| Backend | Django 5, Django REST Framework, simplejwt, Celery, PostgreSQL 16, Redis |
| Frontend | React 19, TypeScript, Vite, React Router, TanStack Query, Zustand, Cytoscape.js |
| Docs | MkDocs with Material |

```text
backend/     Django project: API, PSICQUIC service, data import
frontend/    React web interface (its Docker image also serves the docs)
docs/        Documentation site sources (mkdocs.yml at the root); project notes in docs/project/
migration/   One-off migration from an original openPIP MySQL database
```

## Citing

If you use openPIP, please cite:

> Helmy M, Mee M, Ranjan A, Hao T, Vidal M, Calderwood MA, Luck K, Bader GD.
> OpenPIP: An Open-source Platform for Hosting, Visualizing and Analyzing
> Protein Interaction Data. *J Mol Biol* 434(11):167603 (2022).
> [doi:10.1016/j.jmb.2022.167603](https://doi.org/10.1016/j.jmb.2022.167603)

## License

[MIT](LICENSE), the same license as the original openPIP.

## Acknowledgements

openPIP 2.0 was built as a Google Summer of Code 2026 project with the
[National Resource for Network Biology (NRNB)](https://nrnb.org/), by
Mahafujul Hamid Ananda, mentored by Dr. Mohamed Helmy (VIDO, University of
Saskatchewan) and Dr. Gary Bader (University of Toronto). It rebuilds the
original openPIP by Helmy et al.
