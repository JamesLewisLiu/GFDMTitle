# GFDM Title Archive

A static catalogue of GFDM V4-V8 title unlock requirements: **992 records**, including 583 regular titles and 409 commemorative/badge IDs.

Search and filter by version, category, game, or review status. View original images, song references, and shareable title links; download XLSX or CSV. The interface and requirements support Japanese, English, and Chinese. Title names remain in their original language.

## Local development

Requires Node.js 20+. No dependencies to install.

```sh
npm run dev
```

Open [localhost:4173/GFDMTitle/](http://127.0.0.1:4173/GFDMTitle/).

```sh
npm test          # Validate data and catalogue behavior
npm run build    # Generate dist/
npm run preview  # Serve dist/ locally
```

## GitHub Pages

Push to `main`, then select **GitHub Actions** under **Settings > Pages > Source**. The included workflow validates, builds, and deploys the site. Pull requests only validate and build. Relative asset paths support project sites and custom domains.

## Data

Records are stored in `data/titles.json`; downloads are in `downloads/`. Requirements come from static analysis and original materials. Historical entries and unconfirmed conditions are marked; server events control seasonal availability.

To regenerate data, run `python scripts/import-data.py --source <analysis-directory>` with the source JSON, workbook, and images available. Importing requires `openpyxl`; normal builds do not. Run tests and rebuild afterward.

## License

Site code: [Unlicense](LICENSE). Original game names, hints, and images remain the property of their respective owners.
