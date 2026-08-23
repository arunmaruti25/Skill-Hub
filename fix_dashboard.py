with open('D:\SKILL HUB\pages\dashboard.html', 'r') as f:
    content = f.read()

# Replace the script section
old = '<script src="../js/auth.js"></script>\n<script>\ndocument.addEventListener\'DOMContentLoaded\', () => {\n    loadDashboard();\n    document.getElementById\'searchInput\'?.addEventListener\'input\', (e) => filterDashboard(e.target.value));\n});\n</script>'

new = '<script src="../js/auth.js"></script>\n<script>\nconst API_BASE_URL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"\n    ? "http://127.0.0.1:5000"\n    : "https://skill-hub-backend-4w35.onrender.com";\n\ndocument.addEventListener\'DOMContentLoaded\', () => {\n    const user = JSON.parse(localStorage.getItem("user") || "{}");\n    const adminLink = document.getElementById("adminNavLink");\n    if (adminLink) {\n        adminLink.style.display = (user.role === "admin" || user.isAdmin) ? "flex" : "none";\n    }\n    loadDashboard();\n    document.getElementById\'searchInput\'?.addEventListener\'input\', (e) => filterDashboard(e.target.value));\n});\n</script>'

if old in content:
    content = content.replace(old, new)
    with open('D:\SKILL HUB\pages\dashboard.html', 'w') as f:
        f.write(content)
    print('Replacement successful')
else:
    print('Old string not found')
    
print(f"Content length: {len(content)}")