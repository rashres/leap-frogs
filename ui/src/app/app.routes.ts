import { Routes } from '@angular/router';

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
  {
    path: 'instrument/:id',
    title: 'Instrument — LEAP',
    loadComponent: () => import('./features/instrument/instrument-page').then((m) => m.InstrumentPage),
  },
  { path: '**', redirectTo: 'portfolio' },
];
