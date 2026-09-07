import { Routes } from '@angular/router';

/**
 * Feature routes are added one per pull request, alongside the page they load.
 * Until a page lands, its nav link resolves to the placeholder below.
 */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'portfolio' },
  {
    path: 'portfolio',
    title: 'Portfolio — LEAP',
    loadComponent: () => import('./shell/placeholder-page').then((m) => m.PlaceholderPage),
  },
  { path: '**', redirectTo: 'portfolio' },
];
