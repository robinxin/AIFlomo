# GitHub 打通流程（推荐 SSH）

## 目标
让本地仓库可自动 `git push` 到 GitHub（免重复输入密码）。

## 方案总览
- 推荐：SSH（稳定、长期免输）
- 备选：HTTPS + Token
- 辅助：GitHub CLI（gh）

---

## 方案一：SSH（推荐）

### 1) 生成或确认 SSH Key
```bash
ls -l ~/.ssh/id_ed25519.pub
```
如果不存在：
```bash
ssh-keygen -t ed25519 -C "your_email@example.com"
```
一路回车即可。

### 2) 添加公钥到 GitHub
```bash
cat ~/.ssh/id_ed25519.pub
```
复制输出内容 → GitHub → Settings → SSH and GPG keys → New SSH key → 粘贴保存。

### 3) 测试连接
```bash
ssh -T git@github.com
```
看到 “Hi <username>!” 即成功。

### 4) 设置远端为 SSH
```bash
git remote set-url origin git@github.com:<OWNER>/<REPO>.git
```

### 5) 推送
```bash
git push -u origin <branch>
```

---

## 方案二：HTTPS + Token

### 1) 生成 Token
GitHub → Settings → Developer settings → Personal access tokens
- 选择 Fine-grained 或 Classic
- 赋予 repo 读写权限

### 2) 推送时使用 Token
```bash
git push -u origin <branch>
```
- Username: GitHub 用户名
- Password: 贴 Token

### 3) 可选：保存凭证（macOS）
```bash
git config --global credential.helper osxkeychain
```

---

## 方案三：GitHub CLI（gh）

### 1) 安装
```bash
brew install gh
```

### 2) 登录
```bash
gh auth login
```
选择 GitHub.com → HTTPS → 浏览器登录。

### 3) 推送
```bash
git push -u origin <branch>
```

---

## 常见问题

- **403 没权限**：当前账号没有仓库写权限，找仓库管理员添加 collaborator。
- **SSH 失败**：检查 `ssh -T git@github.com` 和 SSH key 是否已添加。
- **HTTPS 失败**：检查 token 权限或是否过期。

