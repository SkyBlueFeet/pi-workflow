# Contributing

感谢你关注 `pi-workflow`。

当前项目由个人维护，欢迎通过 GitHub Issue 和 Pull Request 参与改进。

## 开始之前

请先确认：

1. Node.js 版本为 `>=20`
2. 已安装项目依赖：`npm install`
3. 可以在本地通过基础检查：`npm run build`、`npm test`、`npm run lint`

## 建议贡献方式

1. 先创建 Issue 说明问题、目标或设计方向
2. 保持改动尽量小且聚焦单一目标
3. 为行为变更补充或更新测试
4. 如涉及对外行为变化，请同步更新 `README.md` 或 `CHANGELOG.md`

## Pull Request 说明

提交 PR 时，建议包含以下信息：

1. 改动背景
2. 解决方案
3. 测试方式
4. 潜在兼容性影响

## 代码风格

仓库使用 TypeScript、ESLint 和 Vitest。

提交前请至少执行：

```bash
npm run build
npm test
npm run lint
```

## 行为准则

参与本项目即表示同意遵守仓库中的 `CODE_OF_CONDUCT.md`。
