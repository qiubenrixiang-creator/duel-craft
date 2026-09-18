import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * GitHub Pages は `https://(ユーザー名).github.io/(リポジトリ名)/` という
 * サブディレクトリ配下で公開されるため、base にリポジトリ名を指定する必要がある。
 *
 * リポジトリ名を変えた場合は、下の REPO_NAME も合わせて変更すること。
 * (独自ドメインや `(ユーザー名).github.io` リポジトリで公開する場合は '/' にする)
 */
const REPO_NAME = 'duel-craft';

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // 開発中はルート、ビルド時のみサブディレクトリを想定する
  base: command === 'build' ? `/${REPO_NAME}/` : '/',
  build: {
    outDir: 'dist',
    // 対戦中に読み込みが発生しないよう、分割しすぎない
    chunkSizeWarningLimit: 1200,
  },
}));
