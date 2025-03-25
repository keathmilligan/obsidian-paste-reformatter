// copy-styles.mjs
import { promises as fs } from 'fs';
import path from 'path';

// Ensure the dist directory exists
async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }
}

async function copyFiles() {
  const distDir = path.resolve('./dist');
  await ensureDir(distDir);
  
  try {
    // Copy styles.css to dist directory
    await fs.copyFile('./styles.css', path.join(distDir, 'styles.css'));
    console.log('Successfully copied styles.css to dist directory');
    
    // Copy manifest.json to dist directory
    await fs.copyFile('./manifest.json', path.join(distDir, 'manifest.json'));
    console.log('Successfully copied manifest.json to dist directory');
  } catch (error) {
    console.error('Error copying files:', error);
    process.exit(1);
  }
}

copyFiles();
