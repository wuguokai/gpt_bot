# gpt_botpress

## 编译
```bash
yarn cache clean
yarn
yarn build
yarn start
```

## 打包镜像
```bash
export npm_config_target_platform=linux
yarn --force --ignore-engines --frozen-lockfile
yarn run build --linux --prod --verbose
yarn run package --linux
cp build/docker/Dockerfile packages/bp/binaries/
cd ./packages/bp/binaries
```
