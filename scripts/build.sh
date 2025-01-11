./node_modules/.bin/tsc
./node_modules/.bin/esbuild dist/index.js --bundle --platform=node --minify --outfile=build/agish.js
node --experimental-sea-config sea-config.json

# For MacOS & Linux
cp $(command -v node) ./build/agish

chmod 755 ./build/agish

# Windows wont work because bash doesn't work there, but this is to remind how to build for windows (this should be automated with Github workflows later)
# See https://nodejs.org/api/single-executable-applications.html
if [ "$(uname)" = 'Windows' ]; then
    node -e "require('fs').copyFileSync(process.execPath, require('path').join('build', 'agish.exe'))" 
fi

if [ "$(uname)" = 'Darwin' ]; then
    codesign --remove-signature ./build/agish 
fi

# Again windows is not actually supported with this script
if [ "$(uname)" = 'Windows' ]; then
    signtool remove /s agish.exe 
fi

# Inject blob into copied binary
if [ "$(uname)" = 'Darwin' ]; then
    npx postject ./build/agish NODE_SEA_BLOB ./build/sea-prep.blob \
    --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 \
    --macho-segment-name NODE_SEA 
fi

if [ "$(uname)" = 'Windows' ]; then
    npx postject ./build/agish.exe NODE_SEA_BLOB ./build/sea-prep.blob ^
        --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 
fi

if [ "$(uname)" = 'Linux' ]; then
    npx postject ./build/agish NODE_SEA_BLOB ./build/sea-prep.blob \
        --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 
fi

if [ "$(uname)" = 'Darwin' ]; then
    codesign --sign - ./build/agish 
fi

if [ "$(uname)" = 'Windows' ]; then
    signtool sign /fd SHA256 ./build/agish.exe 
fi
