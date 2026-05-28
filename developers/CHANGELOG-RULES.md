# CHANGELOG 文档规范

> 本文档定义项目 CHANGELOG 的格式、维护规则与版本管理约束，确保变更历史清晰、可追溯、可验证。

---

## 1. 基本规则

### 1.1 存放位置

- **主文件**：项目根目录 `CHANGELOG.md`
- **存档**（可选）：`CHANGELOG_ARCHIVE.md` 或 `docs/CHANGELOG/`

### 1.2 文件格式与编码

- **格式**：Markdown（`.md`）
- **编码**：UTF-8
- **行尾**：LF（Unix 风格）
- **版本参考**：遵循 [Keep a Changelog](https://keepachangelog.com/) 规范，中文本地化

---

## 2. 版本结构规范

### 2.1 基础格式

```markdown
# CHANGELOG

本文档记录项目的版本发布、功能变更、问题修复与重要更新。

## [版本号] - 发布日期

### Added
- 新增功能描述（要点形式）
- 新增功能描述

### Changed
- 变更的功能或行为
- 变更的功能或行为

### Fixed
- 修复的 bug
- 修复的 bug

### Deprecated
- 标记为弃用的功能

### Removed
- 删除的功能

### Security
- 安全相关的修复与更新

---

## [版本号] - 发布日期

...
```

### 2.2 版本号格式

遵循 [语义化版本](https://semver.org/)（Semantic Versioning）：

```
v<MAJOR>.<MINOR>.<PATCH>[-<PRERELEASE>][+<BUILD>]
```

**示例**：
- `v1.0.0` - 首个正式版本
- `v1.1.0` - 新增功能（向后兼容）
- `v1.0.1` - 修复 bug（向后兼容）
- `v2.0.0` - 重大破坏性变更
- `v1.0.0-beta.1` - 预发布版本
- `v1.0.0-beta.1+20260419` - 包含构建元数据

---

## 3. 版本条目必填字段

### 3.1 版本头信息

每个版本必须包含：

| 字段 | 格式 | 说明 |
|---|---|---|
| 版本号 | `v X.Y.Z` | 遵循语义化版本 |
| 发布日期 | `YYYY-MM-DD` | 发布的实际日期（ISO 8601） |
| 状态（可选） | `[RELEASED]` / `[UNRELEASED]` | `[UNRELEASED]` 表示开发中版本 |

**示例**：
```markdown
## [v1.2.0] - 2026-04-19
## [Unreleased]
```

### 3.2 变更分类

使用以下标准分类，**按此顺序排列**（有内容才写）：

1. **Added** - 新增功能
2. **Changed** - 现有功能的变更（行为、性能、API 调整等）
3. **Deprecated** - 标记为弃用但仍可用的功能（需注明何时移除）
4. **Removed** - 已删除的功能、API、参数等
5. **Fixed** - Bug 修复
6. **Security** - 安全相关的修复与警告

### 3.3 变更描述要求

每条变更需满足：

- **格式**：简明要点形式（短句或单句），首字母大写
- **指向性**：说明变更的**内容**与**影响**，不开玩笑
- **可追溯性**：关键变更需关联 Git Commit Hash（7 位）或 Issue/PR 编号

**示例**：

```markdown
### Added
- 支持 YAML 配置文件格式 (#127)
- 新增 `--verbose` 命令行选项，用于详细日志输出
- 用户认证模块，支持 OAuth 2.0 (commit: a1b2c3d)

### Fixed
- 修复登录页 Safari 兼容性问题 (issue: #345)
- 修复在 Windows 路径包含特殊字符时配置读取失败 (PR #456)

### Deprecated
- API endpoint `/api/v1/users` 将在 v2.0.0 中移除，请迁移至 `/api/v2/users`
```

---

## 4. 版本维护流程

### 4.1 开发阶段（Unreleased）

1. **初始化**：新版本开发开始时，在 CHANGELOG.md 顶部创建 `[Unreleased]` 条目。
2. **持续维护**：每次功能开发/修复完成后，**立即**添加到对应分类下。
3. **禁止忽视**：不允许在发布时才补写，必须边开发边记录。

**示例**：

```markdown
# CHANGELOG

## [Unreleased]

### Added
- 用户权限管理模块
- 新增 JSON Schema 验证器

### Fixed
- 修复数据库连接池泄漏问题

## [v1.0.0] - 2026-04-01
...
```

### 4.2 发布阶段

版本发布前：

1. **更新版本号**：将 `[Unreleased]` 改为 `[vX.Y.Z] - YYYY-MM-DD`。
2. **验证完整性**：检查所有变更是否都已记录。
3. **生成 Git Tag**：
   ```bash
   git tag -a vX.Y.Z -m "Release vX.Y.Z" [commit-hash]
   git push origin vX.Y.Z
   ```
4. **创建新的 Unreleased 条目**：为下一版本开发做准备。

**发布示例**：

```markdown
# CHANGELOG

## [Unreleased]

### Added
- [开发中的新功能登记在此]

## [v1.1.0] - 2026-04-19

### Added
- 用户权限管理模块
- 新增 JSON Schema 验证器

### Fixed
- 修复数据库连接池泄漏问题

## [v1.0.0] - 2026-04-01
...
```

---

## 5. 与 Git Commit 的关联规则

### 5.1 关联格式

在 CHANGELOG 条目中，用以下格式指向 Git 提交：

| 类型 | 格式 | 示例 |
|---|---|---|
| Git Commit Hash（7 位） | `(commit: abc1234)` | `修复缓存失效问题 (commit: f3e2c1d)` |
| Issue 编号 | `(#123)` 或 `(issue: #123)` | `新增登录功能 (#456)` |
| Pull Request | `(PR #789)` 或 `(pull: #789)` | `重构数据库层 (PR #789)` |
| 多关联 | 用逗号分隔 | `重要变更 (commit: a1b2c3d, PR #123)` |

### 5.2 Commit Message 规范

发起 Commit 时，推荐使用 [Conventional Commits](https://www.conventionalcommits.org/) 格式，自动化支持 CHANGELOG 生成：

```
<type>(<scope>): <subject>

<body>

<footer>
```

**类型映射**：

| Commit Type | CHANGELOG 分类 | 说明 |
|---|---|---|
| `feat` | Added | 新增功能 |
| `fix` | Fixed | Bug 修复 |
| `perf` | Changed | 性能优化 |
| `refactor` | Changed | 代码重构 |
| `docs` | Changed | 文档更新 |
| `test` | Changed | 测试相关 |
| `ci` | Changed | CI/CD 相关 |
| `deprecated` | Deprecated | 弃用标记 |
| `breaking` | Removed / Security | 破坏性变更/安全变更 |

**示例**：

```
feat(auth): 支持 OAuth 2.0 第三方登录

- 新增 OAuth 策略工厂
- 集成 Google / GitHub / 微信认证
- 添加 token 刷新机制

Fixes: #456
BREAKING CHANGE: 原有的简单 token 认证已移除，请升级到 OAuth 流程
```

---

## 6. 版本锚点元信息（强制）

在 CHANGELOG.md **文件顶部**添加版本锚点，与 `DOC-RULES.md` 规范保持一致：

```markdown
---
**版本锚点**
- 创建时间：2026-04-19 10:30 +08:00
- 最后更新：2026-04-19 14:45 +08:00
- 代码快照日期：2026-04-19
- Git 分支：main
- Git Commit：a1b2c3d

---

# CHANGELOG

...
```

---

## 7. 维护规则总结

| 动作 | 时机 | 负责人 | 检查点 |
|---|---|---|---|
| 添加变更记录 | 功能/修复完成后 | 开发者/AI | 分类正确、描述清晰、关联完整 |
| 更新版本号 | 发布前 | 版本管理员 | 遵循语义化版本 |
| 生成 Git Tag | 发布时 | 版本管理员 | Tag 格式一致、指向正确 Commit |
| 创建 Unreleased 条目 | 发布后 | 版本管理员 | 为下一版本做好准备 |
| 同步会话记录 | 涉及计划状态变化 | 开发者/AI | 更新 `docs/dev-note_YY-MM-DD.md` |

---

## 8. 禁止事项

- ❌ 发布时才补写 CHANGELOG（应边开发边记录）
- ❌ 变更描述模糊不清（如"修复 bug"）
- ❌ 遗漏关键变更（影响用户的 API 变更或破坏性变更）
- ❌ 版本号不遵循语义化版本
- ❌ 破坏性变更（breaking change）未在分类中突出说明
- ❌ 版本锚点信息缺失或过期

---

## 9. 参考示例

### 完整 CHANGELOG.md 示例

```markdown
---
**版本锚点**
- 创建时间：2026-04-19 10:00 +08:00
- 最后更新：2026-04-19 15:30 +08:00
- 代码快照日期：2026-04-19
- Git 分支：main
- Git Commit：a1b2c3d

---

# CHANGELOG

本文档记录项目版本发布与变更历史。

## [Unreleased]

### Added
- 国际化（i18n）多语言支持框架

## [v2.0.0] - 2026-04-19

### Added
- 新安装向导，首次启动时自动配置（PR #201）
- 插件系统，支持第三方扩展（commit: f3e2c1d）

### Changed
- 配置文件格式从 INI 升级为 YAML（#202）
- 重构数据库连接层，性能提升 30% (commit: e2d1c0b)

### Deprecated
- REST API v1 将在 v3.0.0 中移除，请迁移至 v2 API

### Fixed
- 修复大文件上传超时问题 (#198)
- 修复登录页在 Safari 15+ 的样式错误 (commit: c1b0a9f)

### Security
- 升级 OpenSSL 至 1.1.1w，修复 CVE-2023-XXXXX
- 修复用户会话 fixation 漏洞 (PR #203)

## [v1.0.0] - 2026-03-10

### Added
- 首个正式版本发布
- 基础用户认证与授权
- RESTful API v1
```

---

## 10. 扩展阅读

- [Keep a Changelog](https://keepachangelog.com/) - 通用 CHANGELOG 格式规范
- [语义化版本](https://semver.org/) - 版本号规范
- [Conventional Commits](https://www.conventionalcommits.org/) - Git 提交规范
- `developers/DOC-RULES.md` - 文档维护通用规则
- `developers/PLANS/TEMPLATE.md` - 计划文档模板
