import { defineConfig, Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import preact from '@preact/preset-vite';
import fs from 'node:fs';
import path from 'node:path';
import LZString from 'lz-string';

/**
 * If a `seed.json` exists in the project root, inline its content into the
 * built quire.html's <script id="quire-data"> block as compressed LZ-UTF16,
 * matching the runtime save format.  The file is published with welcome
 * content baked in.
 *
 * If `seed.json` is missing, the build proceeds with an empty data block.
 * If it's invalid, the build fails loudly.
 */
function seedDataPlugin(): Plugin {
  return {
    name: 'quire-seed-data',
    transformIndexHtml(html) {
      const seedPath = path.resolve(__dirname, 'seed.json');
      if (!fs.existsSync(seedPath)) return html;
      let raw: string;
      try {
        raw = fs.readFileSync(seedPath, 'utf-8');
      } catch (e) {
        throw new Error(`Failed to read seed.json: ${(e as Error).message}`);
      }
      let parsed: any;
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        throw new Error(
          `seed.json is not a valid JSON file: ${(e as Error).message}`,
        );
      }
      // Unwrap the export envelope, if present (same logic as the runtime importer).
      const data = parsed?.format === 'quire-export' ? parsed.data : parsed;
      if (!data || typeof data !== 'object') {
        throw new Error('seed.json does not contain a valid WikiState');
      }
      if (typeof data.schemaVersion !== 'number' || !Array.isArray(data.leaves)) {
        throw new Error('seed.json does not contain a valid WikiState');
      }
      const compressed = LZString.compressToUTF16(JSON.stringify(data));
      // Escape `</` defensively just like the runtime does
      const safe = compressed.replace(/<\/(script)/gi, '<\\/$1');
      const tag = `<script id="quire-data" type="application/json" data-encoding="lz-utf16">${safe}</script>`;
      return html.replace(
        /<script\s+id="quire-data"[^>]*>[\s\S]*?<\/script>/,
        tag,
      );
    },
  };
}

export default defineConfig({
  // Preact's preset wires its JSX runtime and aliases react / react-dom
  // to preact/compat at build time.  Source code keeps importing from 'react'.
  plugins: [preact(), seedDataPlugin(), viteSingleFile()],
  resolve: {
    alias: {
      react: 'preact/compat',
      'react-dom': 'preact/compat',
      'react-dom/client': 'preact/compat/client',
      'react/jsx-runtime': 'preact/jsx-runtime',
      'react/jsx-dev-runtime': 'preact/jsx-runtime',
    },
  },
  esbuild: {
    drop: ['console', 'debugger'],
  },
  build: {
    target: 'es2022',
    cssCodeSplit: false,
    assetsInlineLimit: 100000000,
    chunkSizeWarningLimit: 100000000,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        manualChunks: undefined,
      },
    },
    outDir: 'dist',
    emptyOutDir: true,
  },
});
