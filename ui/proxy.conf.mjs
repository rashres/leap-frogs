/**
 * Dev-server proxy: the browser only ever calls same-origin /api/..., and the
 * Angular dev server forwards it to the Spring Boot API.
 *
 * Point it at a different API with LEAP_API_URL, e.g.
 *   LEAP_API_URL=http://10.0.0.5:8081 npm start
 */
const target = process.env.LEAP_API_URL || 'http://localhost:8081';

export default {
  '/api': {
    target,
    secure: false,
    changeOrigin: true,
    // Spring redirects (/api -> /api/, Swagger UI) would otherwise point the browser straight at the API host.
    autoRewrite: true,
  },
};
