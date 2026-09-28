import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1];
const isGitHubActions = process.env.GITHUB_ACTIONS === 'true';

export default defineConfig({
  plugins: [react()],
  // GitHub project Pages serves this repository from /BusinessGame/.
  // Local development continues to use the normal root path.
  base: isGitHubActions && repositoryName ? `/${repositoryName}/` : '/',
});
