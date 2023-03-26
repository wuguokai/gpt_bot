# gpt_botpress

## 编译启动
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
docker build -t registry.cn-hangzhou.aliyuncs.com/wuguokai/gpt_botpress:0.1.0 . # 注意更换版本
```
