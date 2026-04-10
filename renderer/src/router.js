import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Dashboard',
    component: () => import('./views/Dashboard.vue'),
  },
  {
    path: '/flows',
    name: 'FlowEditor',
    component: () => import('./views/FlowEditor.vue'),
  },
  {
    path: '/variables',
    name: 'Variables',
    component: () => import('./views/Variables.vue'),
  },
  {
    path: '/database',
    name: 'Database',
    component: () => import('./views/Database.vue'),
  },
  {
    path: '/logs',
    name: 'Logs',
    component: () => import('./views/Logs.vue'),
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('./views/Settings.vue'),
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router
