# Frontend

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.2.22.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## News API key

The News page reads live headlines from NewsAPI.org. The key is never in the
bundle: `proxy.conf.mjs` reads it on the Node side of the dev-server proxy and
attaches it as a request header, so the browser only ever calls `/api/news`.

```bash
# frontend/.env.local — gitignored, never committed
LEAP_NEWSAPI_KEY=your-key-here
```

An environment variable of the same name takes precedence over the file. With no
key configured, the page falls back to the keyless Yahoo Finance feed and says
so; nothing is invented in either case.

The developer plan allows 100 requests a day and its archive is a few days deep,
so headlines are cached for fifteen minutes and one page load costs one request.
A deployed build has no dev server and therefore no proxy — the Spring backend
must own this call. See `docs/open-questions.md` OQ-15.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
