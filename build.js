const { build } = require('esbuild');
const { join } = require('path');

// Build options
const buildOptions = {
  entryPoints: [join(__dirname, 'src/extension.ts')],
  bundle: true,
  outfile: join(__dirname, 'out/extension.js'),
  external: ['vscode'], // Don't bundle vscode API
  platform: 'node',
  target: 'node12', // Ensures compatibility with VS Code's Node.js version
  format: 'cjs',
  minify: true, // Minify the output
  sourcemap: false, // Set to true for debugging
  treeShaking: true, // Remove unused code
  define: {
    'process.env.NODE_ENV': '"production"'
  },
};

// Production build
async function runBuild() {
  try {
    await build(buildOptions);
    console.log('⚡ Build complete! ⚡');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

// Development build with watch mode
async function runWatch() {
  try {
    const watchOptions = {
      ...buildOptions,
      watch: {
        onRebuild(error) {
          if (error) {
            console.error('Watch build failed:', error);
          } else {
            console.log('⚡ Watch build succeeded ⚡');
          }
        },
      },
      minify: false, // Don't minify in watch mode for faster builds
      sourcemap: true, // Enable sourcemaps for debugging
    };
    
    await build(watchOptions);
    console.log('⚡ Watch mode enabled, waiting for changes... ⚡');
  } catch (error) {
    console.error('Watch build failed:', error);
    process.exit(1);
  }
}

// Check if we're in watch mode
const watchMode = process.argv.includes('--watch');
if (watchMode) {
  runWatch();
} else {
  runBuild();
} 