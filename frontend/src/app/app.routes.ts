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
    loadComponent: () => import('./features/portfolio/portfolio-page').then((m) => m.PortfolioPage),
  },
  {
    path: 'markets',
    title: 'Markets — LEAP',
    loadComponent: () => import('./features/markets/markets-page').then((m) => m.MarketsPage),
  },
  {
    path: 'news',
    title: 'News — LEAP',
    loadComponent: () => import('./features/news/news-page').then((m) => m.NewsPage),
  },
  {
    path: 'orders',
    title: 'Orders — LEAP',
    loadComponent: () => import('./features/orders/orders-page').then((m) => m.OrdersPage),
  },
  { path: '**', redirectTo: 'portfolio' },
];
