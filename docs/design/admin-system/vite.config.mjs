import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/postcss';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../',import.meta.url));
export default defineConfig({
  root:fileURLToPath(new URL('./',import.meta.url)),
  plugins:[react()],
  css:{postcss:{plugins:[tailwind()]}},
  resolve:{alias:{'@':root}},
  server:{host:'127.0.0.1',port:3018,strictPort:true,fs:{allow:[root],deny:['**/.env*','**/.dev.vars*','**/private-data/**','**/docs/code_s','**/.git/**','**/.wrangler/**']}},
  build:{outDir:'.preview-build',emptyOutDir:true},
});
