
# Remove node_modules
rm -rf node_modules
rm -rf packages/api/node_modules
rm -rf apps/web/node_modules

# Fresh install
pnpm i
