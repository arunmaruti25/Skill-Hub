const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const User = require("./models/user");
const Project = require("./models/Project");
const JoinRequest = require("./models/JoinRequest");
const Notification = require("./models/Notification");
const Message = require("./models/Message");

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || "skillhub_super_secret_jwt_key_2026";
const POP_USER = "name email profileImage profession skills bio";

// ================= STORAGE & MIDDLEWARE =================
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, uploadDir),
        filename: (req, file, cb) => cb(null, `avatar-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname).toLowerCase()}`)
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (/jpeg|jpg|png|webp|gif/.test(path.extname(file.originalname).toLowerCase()) && /jpeg|jpg|png|webp|gif/.test(file.mimetype)) {
            cb(null, true);
        } else cb(new Error("Only image files (JPEG, PNG, WebP, GIF) are allowed!"));
    }
});

app.use(cors({ origin: "*", methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"], allowedHeaders: ["Content-Type", "Authorization"], credentials: true }));
app.use(express.json());
app.use("/uploads", express.static(uploadDir));

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many authentication attempts. Please try again later." }
});

// Helper: Format User
const formatUser = u => ({
    id: u._id.toString(), _id: u._id.toString(), name: u.name, email: u.email,
    profession: u.profession || "", bio: u.bio || "", location: u.location || "",
    experience: u.experience || "Beginner", availability: u.availability || "Available",
    skills: u.skills || [], github: u.github || "", linkedin: u.linkedin || "",
    profileImage: u.profileImage || "", role: u.role || "user", createdAt: u.createdAt
});

const generateToken = u => jwt.sign({ id: u._id.toString(), _id: u._id.toString(), name: u.name, email: u.email, role: u.role || "user" }, JWT_SECRET, { expiresIn: "7d" });

// Middlewares
function authenticateToken(req, res, next) {
    const token = req.headers["authorization"]?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Access denied. No token provided." });
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ message: "Invalid or expired token." });
        req.user = decoded;
        next();
    });
}

function optionalAuth(req, res, next) {
    const token = req.headers["authorization"]?.split(" ")[1];
    if (token) jwt.verify(token, JWT_SECRET, (err, decoded) => { if (!err) req.user = decoded; next(); });
    else next();
}

async function requireAdmin(req, res, next) {
    if (!req.user) return res.status(401).json({ message: "Authentication required." });
    const user = await User.findById(req.user.id || req.user._id);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Admin access required." });
    next();
}

// ================= AUTH ROUTES =================
app.get("/", (req, res) => res.json({ status: "ok", message: "Skill Hub Backend is running!" }));

const handleRegister = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) return res.status(400).json({ message: "Name, email, and password are required" });
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return res.status(400).json({ message: "Please provide a valid email address" });
        if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters long" });

        const normalizedEmail = email.toLowerCase().trim();
        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser) return res.status(400).json({ message: "Email is already registered. Please sign in." });

        const user = await User.create({
            name: name.trim(),
            email: normalizedEmail,
            password: await bcrypt.hash(password, 10),
            role: "user"
        });

        res.status(201).json({ message: "Account created successfully!", token: generateToken(user), user: formatUser(user) });
    } catch (e) {
        console.error("Register error:", e);
        res.status(500).json({ message: "Server error during registration" });
    }
};

const handleLogin = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ message: "Email and password are required" });
        const user = await User.findOne({ email: email.toLowerCase().trim() });
        if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ message: "Invalid email or password" });

        res.json({ message: "Login successful", token: generateToken(user), user: formatUser(user) });
    } catch (e) { res.status(500).json({ message: "Server error during login" }); }
};

const handlePasswordReset = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email) return res.status(400).json({ message: "Email is required" });
        const user = await User.findOne({ email: email.toLowerCase().trim() });
        if (!user) return res.status(404).json({ message: "No account found with this email address" });

        if (password) {
            if (password.length < 6) return res.status(400).json({ message: "New password must be at least 6 characters long" });
            user.password = await bcrypt.hash(password, 10);
            await user.save();
            return res.json({ message: "Password reset successfully! You can now log in." });
        }
        res.json({ message: "Password reset instructions have been sent to your email." });
    } catch (e) { res.status(500).json({ message: "Could not reset password. Server error." }); }
};

app.post("/api/register", authLimiter, handleRegister);
app.post("/api/auth/register", authLimiter, handleRegister);
app.post("/api/login", authLimiter, handleLogin);
app.post("/api/auth/login", authLimiter, handleLogin);
app.post("/api/reset-password", authLimiter, handlePasswordReset);
app.post("/api/auth/reset-password", authLimiter, handlePasswordReset);
app.post("/api/auth/forgot-password", authLimiter, handlePasswordReset);

app.get("/api/auth/me", authenticateToken, async (req, res) => {
    const user = await User.findById(req.user.id || req.user._id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ user: formatUser(user) });
});

// ================= SKILLS =================
app.get("/api/skills", async (req, res) => {
    try {
        const defaults = ["React", "Node.js", "Python", "JavaScript", "TypeScript", "UI/UX", "Java", "C++", "AI / ML", "Database", "MongoDB", "Express", "HTML/CSS", "Tailwind CSS", "Figma", "Docker", "DevOps", "AWS", "Flutter", "SQL"];
        const [uSkills, pSkills] = await Promise.all([User.distinct("skills"), Project.distinct("skills")]);
        res.json(Array.from(new Set([...defaults, ...uSkills, ...pSkills])).filter(Boolean).sort());
    } catch (e) { res.status(500).json({ message: "Could not load skills" }); }
});

// ================= USERS & PROFILE =================
app.get("/api/users", optionalAuth, async (req, res) => {
    try {
        const { search, skill } = req.query;
        const query = {};
        if (search) {
            const regex = new RegExp(search.trim(), "i");
            query.$or = [{ name: regex }, { profession: regex }, { bio: regex }, { skills: regex }];
        }
        if (skill) query.skills = { $in: [new RegExp(`^${skill.trim()}$`, "i")] };
        const users = await User.find(query).select("-password").sort({ name: 1 });
        res.json(users.map(formatUser));
    } catch (e) { res.status(500).json({ message: "Could not load users" }); }
});

const getProfileHandler = async (req, res) => {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(formatUser(user));
};
app.get("/api/profile/:id", getProfileHandler);
app.get("/api/users/:id", getProfileHandler);

const updateProfileHandler = async (req, res) => {
    try {
        const targetId = req.params.id;
        const requesterId = req.user.id || req.user._id;

        // Only the profile owner can update their own profile (admin cannot modify profiles via this endpoint for oversight)
        // The existing behavior: admin CAN edit profiles (legitimate moderation). We enforce: password never touched here.
        if (requesterId !== targetId && req.user.role !== "admin") {
            return res.status(403).json({ message: "Unauthorized profile update" });
        }

        const fields = ["name", "profession", "bio", "location", "experience", "availability", "github", "linkedin"];
        const updateData = {};
        fields.forEach(f => { if (req.body[f] !== undefined) updateData[f] = typeof req.body[f] === "string" ? req.body[f].trim() : req.body[f]; });
        if (req.body.skills !== undefined) updateData.skills = Array.isArray(req.body.skills) ? req.body.skills : [];
        // Only allow admin to update email (legitimate admin moderation)
        if (req.body.email && req.user?.role === "admin") updateData.email = req.body.email.toLowerCase().trim();
        // Never allow password to be set via profile update
        delete updateData.password;

        const user = await User.findByIdAndUpdate(targetId, updateData, { new: true, runValidators: true }).select("-password");
        if (!user) return res.status(404).json({ message: "User not found" });
        res.json({ message: "Profile updated successfully", user: formatUser(user) });
    } catch (e) { res.status(500).json({ message: "Server error updating profile" }); }
};
app.put("/api/profile/:id", authenticateToken, updateProfileHandler);
app.put("/api/users/:id", authenticateToken, updateProfileHandler);

const uploadImageHandler = (req, res) => {
    upload.single("image")(req, res, async (err) => {
        if (err) return res.status(400).json({ message: err.message || "Upload error" });
        try {
            const targetId = req.params.id;
            if (req.user && req.user.id !== targetId && req.user.role !== "admin") return res.status(403).json({ message: "Unauthorized image upload" });
            if (!req.file) return res.status(400).json({ message: "No image file provided" });

            const user = await User.findById(targetId);
            if (!user) return res.status(404).json({ message: "User not found" });

            if (user.profileImage?.startsWith("/uploads/")) {
                const old = path.join(__dirname, user.profileImage);
                if (fs.existsSync(old)) fs.unlink(old, () => {});
            }

            user.profileImage = "/uploads/" + req.file.filename;
            await user.save();
            res.json({ message: "Profile image uploaded successfully", user: formatUser(user) });
        } catch (e) { res.status(500).json({ message: "Image upload failed" }); }
    });
};
app.post("/api/profile/:id/image", authenticateToken, uploadImageHandler);
app.post("/api/users/:id/image", authenticateToken, uploadImageHandler);

const deleteImageHandler = async (req, res) => {
    try {
        const targetId = req.params.id;
        if (req.user && req.user.id !== targetId && req.user.role !== "admin") return res.status(403).json({ message: "Unauthorized" });
        const user = await User.findById(targetId);
        if (!user) return res.status(404).json({ message: "User not found" });

        if (user.profileImage?.startsWith("/uploads/")) {
            const old = path.join(__dirname, user.profileImage);
            if (fs.existsSync(old)) fs.unlink(old, () => {});
        }
        user.profileImage = "";
        await user.save();
        res.json({ message: "Profile image removed successfully", user: formatUser(user) });
    } catch (e) { res.status(500).json({ message: "Could not remove profile image" }); }
};
app.delete("/api/profile/:id/image", authenticateToken, deleteImageHandler);
app.delete("/api/users/:id/image", authenticateToken, deleteImageHandler);

app.get("/api/users/:id/projects", async (req, res) => {
    try {
        const uid = req.params.id;
        const projects = await Project.find({ $or: [{ owner: uid }, { members: uid }] }).populate("owner members", POP_USER).sort({ createdAt: -1 });
        res.json(projects);
    } catch (e) { res.status(500).json({ message: "Could not load user projects" }); }
});

// ================= PROJECTS =================
app.get("/api/projects", optionalAuth, async (req, res) => {
    try {
        const { search, skill, sort } = req.query;
        const query = {};
        if (search) {
            const regex = new RegExp(search.trim(), "i");
            query.$or = [{ title: regex }, { description: regex }, { skills: regex }];
        }
        if (skill) query.skills = { $in: [new RegExp(`^${skill.trim()}$`, "i")] };

        const sortOption = sort === "oldest" ? { createdAt: 1 } : (sort === "popular" ? { "members.length": -1, createdAt: -1 } : { createdAt: -1 });
        const projects = await Project.find(query).populate("owner members", POP_USER).sort(sortOption);
        res.json(projects);
    } catch (e) { res.status(500).json({ message: "Server error fetching projects" }); }
});

app.get("/api/projects/:id", optionalAuth, async (req, res) => {
    const project = await Project.findById(req.params.id).populate("owner members", POP_USER);
    if (!project) return res.status(404).json({ message: "Project not found" });
    res.json(project);
});

app.post("/api/projects", authenticateToken, async (req, res) => {
    try {
        const { title, description, skills } = req.body;
        const ownerId = req.user.id || req.user._id; // Always from JWT, never from body
        if (!title || !description) return res.status(400).json({ message: "Title and description are required" });

        const pSkills = Array.isArray(skills) ? skills : (typeof skills === "string" ? skills.split(",").map(s => s.trim()).filter(Boolean) : []);
        const project = await Project.create({ title: title.trim(), description: description.trim(), owner: ownerId, skills: pSkills, members: [ownerId] });
        res.status(201).json({ message: "Project created successfully", project: await Project.findById(project._id).populate("owner members", POP_USER) });
    } catch (e) { res.status(500).json({ message: "Server error creating project" }); }
});

app.put("/api/projects/:id", authenticateToken, async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ message: "Project not found" });
        if (project.owner.toString() !== (req.user.id || req.user._id)) return res.status(403).json({ message: "Unauthorized project edit" });

        const { title, description, skills } = req.body;
        if (title) project.title = title.trim();
        if (description) project.description = description.trim();
        if (skills !== undefined) project.skills = Array.isArray(skills) ? skills : (typeof skills === "string" ? skills.split(",").map(s => s.trim()).filter(Boolean) : []);
        await project.save();
        res.json({ message: "Project updated successfully", project: await Project.findById(project._id).populate("owner members", POP_USER) });
    } catch (e) { res.status(500).json({ message: "Server error updating project" }); }
});

app.delete("/api/projects/:id", authenticateToken, async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ message: "Project not found" });
        if (project.owner.toString() !== (req.user.id || req.user._id)) return res.status(403).json({ message: "Unauthorized project delete" });

        await Promise.all([Project.findByIdAndDelete(project._id), JoinRequest.deleteMany({ project: project._id }), Notification.deleteMany({ project: project._id })]);
        res.json({ message: "Project deleted successfully" });
    } catch (e) { res.status(500).json({ message: "Server error deleting project" }); }
});

const handleJoinRequestCreation = async (req, res) => {
    try {
        const projectId = req.params.projectId || req.params.id;
        const requesterId = req.user?.id || req.user?._id; // Always from JWT
        if (!requesterId) return res.status(401).json({ message: "Requester authentication required" });

        const project = await Project.findById(projectId);
        if (!project) return res.status(404).json({ message: "Project not found" });
        if (project.owner.toString() === requesterId.toString() || project.members.some(m => m.toString() === requesterId.toString())) {
            return res.status(400).json({ message: "You are already a member or owner of this project" });
        }

        const existing = await JoinRequest.findOne({ project: project._id, requester: requesterId, status: "pending" });
        if (existing) return res.status(400).json({ message: "You already have a pending join request for this project" });

        const joinRequest = await JoinRequest.create({ project: project._id, requester: requesterId });
        const requester = await User.findById(requesterId);
        if (requester) {
            await Notification.create({ recipient: project.owner, message: `${requester.name} requested to join your project "${project.title}".`, type: "join_request", project: project._id, request: joinRequest._id });
        }
        res.status(201).json({ message: "Join request sent successfully!", request: joinRequest });
    } catch (e) { res.status(500).json({ message: "Server error sending join request" }); }
};

app.post("/api/projects/:projectId/request", authenticateToken, handleJoinRequestCreation);
app.post("/api/projects/:projectId/join", authenticateToken, handleJoinRequestCreation);

app.post("/api/projects/:projectId/leave", authenticateToken, async (req, res) => {
    try {
        const project = await Project.findById(req.params.projectId);
        if (!project) return res.status(404).json({ message: "Project not found" });
        const uid = req.user.id || req.user._id;
        if (project.owner.toString() === uid.toString()) return res.status(400).json({ message: "Project owners cannot leave their own project." });

        project.members = project.members.filter(m => m.toString() !== uid.toString());
        await project.save();
        res.json({ message: "You have left the project successfully." });
    } catch (e) { res.status(500).json({ message: "Server error leaving project" }); }
});

app.post("/api/projects/:projectId/invite", authenticateToken, async (req, res) => {
    try {
        const inviterId = req.user.id || req.user._id;
        const { invitee } = req.body;
        if (!invitee) return res.status(400).json({ message: "Invitee ID is required" });

        const project = await Project.findById(req.params.projectId);
        if (!project) return res.status(404).json({ message: "Project not found" });
        if (project.owner.toString() !== inviterId.toString()) return res.status(403).json({ message: "Only project owner can invite" });

        if (inviterId.toString() === invitee.toString()) return res.status(400).json({ message: "Cannot invite yourself" });
        if (project.members.some(m => m.toString() === invitee.toString()) || project.owner.toString() === invitee.toString()) {
            return res.status(400).json({ message: "User is already a member or owner" });
        }

        const existingInvite = await JoinRequest.findOne({ project: project._id, requester: invitee, type: "invite", status: "pending" });
        if (existingInvite) return res.status(400).json({ message: "Pending invite already exists" });

        const [invitedUser, inviterUser] = await Promise.all([User.findById(invitee), User.findById(inviterId)]);
        if (!invitedUser) return res.status(404).json({ message: "Invited user not found" });

        const joinRequest = await JoinRequest.create({ project: project._id, requester: invitee, type: "invite" });
        
        const notification = await Notification.create({
            recipient: invitee,
            message: `${inviterUser.name} invited you to join "${project.title}".`,
            type: "project_invite",
            project: project._id,
            request: joinRequest._id
        });
        res.status(201).json({ message: "Invitation sent successfully", notification });
    } catch (e) { res.status(500).json({ message: "Server error sending invitation" }); }
});

app.get("/api/projects/:projectId/requests", authenticateToken, async (req, res) => {
    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (project.owner.toString() !== (req.user.id || req.user._id) && req.user.role !== "admin") return res.status(403).json({ message: "Only owner can view requests" });

    const requests = await JoinRequest.find({ project: project._id, status: "pending" }).populate("requester", POP_USER).populate("project", "title").sort({ createdAt: -1 });
    res.json(requests);
});

// ================= REQUESTS =================
app.get("/api/requests", authenticateToken, async (req, res) => {
    try {
        const uid = req.user.id || req.user._id; // Always from JWT
        const type = req.query.type || "received";
        const myProjects = await Project.find({ owner: uid });
        const myProjectIds = myProjects.map(p => p._id);
        
        if (type === "sent") {
            const requests = await JoinRequest.find({
                $or: [
                    { requester: uid, type: "request" },
                    { project: { $in: myProjectIds }, type: "invite" }
                ]
            }).populate("project", "title description owner").populate("requester", POP_USER).sort({ createdAt: -1 });
            return res.json(requests);
        }
        
        const requests = await JoinRequest.find({
            $or: [
                { project: { $in: myProjectIds }, type: "request" },
                { requester: uid, type: "invite" }
            ]
        }).populate("project", "title description owner").populate("requester", POP_USER).sort({ createdAt: -1 });
        res.json(requests);
    } catch (e) { res.status(500).json({ message: "Server error loading requests" }); }
});

app.get("/api/requests/sent/:userId", authenticateToken, async (req, res) => {
    const requests = await JoinRequest.find({ requester: req.params.userId }).populate("project", "title description").populate("requester", POP_USER).sort({ createdAt: -1 });
    res.json(requests);
});

app.get("/api/requests/received/:userId", authenticateToken, async (req, res) => {
    const pids = (await Project.find({ owner: req.params.userId })).map(p => p._id);
    const requests = await JoinRequest.find({ project: { $in: pids } }).populate("project", "title description").populate("requester", POP_USER).sort({ createdAt: -1 });
    res.json(requests);
});

const processRequestStatus = async (requestId, status, userId) => {
    const request = await JoinRequest.findById(requestId).populate("project");
    if (!request) throw new Error("Request not found");
    if (request.status !== "pending") throw new Error("Request already processed");

    const project = await Project.findById(request.project._id || request.project);
    if (!project) throw new Error("Project not found");
    
    if (request.type === "invite") {
        if (request.requester.toString() !== userId.toString()) throw new Error("Only the invited user can respond to this invite");
    } else {
        if (project.owner.toString() !== userId.toString()) throw new Error("Only project owner can manage requests");
    }

    request.status = status;
    await request.save();

    if (status === "accepted" && !project.members.some(m => m.toString() === request.requester.toString())) {
        project.members.push(request.requester);
        await project.save();
    }

    if (request.type === "invite") {
        await Notification.create({
            recipient: project.owner,
            message: status === "accepted" ? `User accepted your invitation to join "${project.title}".` : `User declined your invitation to join "${project.title}".`,
            type: status === "accepted" ? "request_accepted" : "request_rejected",
            project: project._id,
            request: request._id
        });
    } else {
        await Notification.create({
            recipient: request.requester,
            message: status === "accepted" ? `Your request to join "${project.title}" has been accepted!` : `Your request to join "${project.title}" was declined.`,
            type: status === "accepted" ? "request_accepted" : "request_rejected",
            project: project._id,
            request: request._id
        });
    }

    await Notification.updateMany({ request: request._id }, { $set: { read: true } });
    
    return request;
};

app.patch("/api/requests/:requestId", authenticateToken, async (req, res) => {
    try {
        const { status } = req.body;
        if (!["accepted", "rejected"].includes(status)) return res.status(400).json({ message: "Status must be 'accepted' or 'rejected'" });
        const request = await processRequestStatus(req.params.requestId, status, req.user.id || req.user._id);
        res.json({ message: `Request ${status} successfully`, request });
    } catch (e) { res.status(400).json({ message: e.message || "Could not process request" }); }
});

app.put("/api/requests/:requestId/accept", authenticateToken, async (req, res) => {
    try {
        const request = await processRequestStatus(req.params.requestId, "accepted", req.user.id || req.user._id);
        res.json({ message: "Request accepted successfully", request });
    } catch (e) { res.status(400).json({ message: e.message || "Could not accept request" }); }
});

app.put("/api/requests/:requestId/reject", authenticateToken, async (req, res) => {
    try {
        const request = await processRequestStatus(req.params.requestId, "rejected", req.user.id || req.user._id);
        res.json({ message: "Request rejected successfully", request });
    } catch (e) { res.status(400).json({ message: e.message || "Could not reject request" }); }
});

app.delete("/api/requests/:requestId", authenticateToken, async (req, res) => {
    try {
        const request = await JoinRequest.findById(req.params.requestId);
        if (!request) return res.status(404).json({ message: "Request not found" });

        const uid = req.user.id || req.user._id;
        const project = await Project.findById(request.project);
        if (request.requester.toString() !== uid.toString() && project?.owner.toString() !== uid.toString()) {
            return res.status(403).json({ message: "Unauthorized to delete this request" });
        }
        await JoinRequest.findByIdAndDelete(request._id);
        res.json({ message: "Request cancelled / deleted successfully" });
    } catch (e) { res.status(500).json({ message: "Server error deleting request" }); }
});

// ================= NOTIFICATIONS =================
const getNotificationsHandler = async (req, res) => {
    const uid = req.user?.id || req.user?._id; // Always from JWT, not params
    if (!uid) return res.status(401).json({ message: "User ID required" });
    const notifications = await Notification.find({ recipient: uid }).populate("project", "title").populate("request").sort({ createdAt: -1 });
    res.json(notifications);
};
app.get("/api/notifications", authenticateToken, getNotificationsHandler);
app.get("/api/notifications/:userId", authenticateToken, getNotificationsHandler);

app.put("/api/notifications/:id/read", authenticateToken, async (req, res) => {
    const notification = await Notification.findByIdAndUpdate(req.params.id, { read: true }, { new: true });
    if (!notification) return res.status(404).json({ message: "Notification not found" });
    res.json(notification);
});

const markAllReadHandler = async (req, res) => {
    const uid = req.user?.id || req.user?._id; // Always from JWT
    if (!uid) return res.status(401).json({ message: "User ID required" });
    await Notification.updateMany({ recipient: uid, read: false }, { $set: { read: true } });
    res.json({ message: "All notifications marked as read" });
};
app.put("/api/notifications/read-all", authenticateToken, markAllReadHandler);
app.put("/api/notifications/read-all/:userId", authenticateToken, markAllReadHandler);

// Invites are now handled via /api/requests endpoints

// ================= MESSAGES (PRIVATE — IDOR PROTECTED) =================
app.post("/api/messages", authenticateToken, async (req, res) => {
    try {
        // Sender is ALWAYS derived from verified JWT — never trust req.body.sender
        const sender = req.user.id || req.user._id;
        const { receiver, message } = req.body;
        if (!receiver || !message?.trim()) return res.status(400).json({ message: "Receiver and message text are required" });
        if (sender.toString() === receiver.toString()) return res.status(400).json({ message: "You cannot message yourself" });

        const [sUser, rUser] = await Promise.all([User.findById(sender), User.findById(receiver)]);
        if (!sUser || !rUser) return res.status(404).json({ message: "User not found" });

        const msg = await Message.create({ sender, receiver, message: message.trim() });
        
        // Prevent duplicate unread message notifications from the same sender
        const existingNotif = await Notification.findOne({ recipient: receiver, type: "new_message", sender: sender, read: false });
        if (!existingNotif) {
            await Notification.create({
                recipient: receiver,
                message: `New message from ${sUser.name}: "${message.length > 20 ? message.substring(0, 20) + '...' : message}"`,
                type: "new_message",
                sender: sender
            });
        }
        
        res.status(201).json(await Message.findById(msg._id).populate("sender receiver", POP_USER));
    } catch (e) { res.status(500).json({ message: "Could not send message" }); }
});

app.get("/api/messages/:user1/:user2", authenticateToken, async (req, res) => {
    try {
        const { user1, user2 } = req.params;
        const currentUserId = req.user.id || req.user._id;

        // Security: only participants or admin can read the conversation
        if (currentUserId !== user1 && currentUserId !== user2 && req.user.role !== "admin") {
            return res.status(403).json({ message: "Access denied. You are not a participant in this conversation." });
        }

        const messages = await Message.find({ $or: [{ sender: user1, receiver: user2 }, { sender: user2, receiver: user1 }] }).populate("sender receiver", POP_USER).sort({ createdAt: 1 });

        // Only mark messages as read if requester is a participant (not admin oversight)
        if (req.user.role !== "admin") {
            const otherId = currentUserId === user1 ? user2 : user1;
            await Message.updateMany({ sender: otherId, receiver: currentUserId, read: false }, { $set: { read: true } });
        }

        res.json(messages);
    } catch (e) { res.status(500).json({ message: "Could not load messages" }); }
});

app.put("/api/messages/read/:userId/:otherUserId", authenticateToken, async (req, res) => {
    // Enforce: only the recipient (userId) can mark their messages as read — not anyone else
    const currentUserId = req.user.id || req.user._id;
    if (currentUserId !== req.params.userId && req.user.role !== "admin") {
        return res.status(403).json({ message: "Access denied." });
    }
    await Message.updateMany({ sender: req.params.otherUserId, receiver: req.params.userId, read: false }, { $set: { read: true } });
    res.json({ message: "Messages marked as read" });
});

const getConversationsHandler = async (req, res) => {
    try {
        // Always derive from JWT — never trust req.params.userId for the authenticated user
        const uid = req.user?.id || req.user?._id;
        if (!uid) return res.status(401).json({ message: "Authentication required" });

        const messages = await Message.find({ $or: [{ sender: uid }, { receiver: uid }] }).populate("sender receiver", POP_USER).sort({ createdAt: -1 });
        const conversations = [];
        const seen = new Set();

        for (const msg of messages) {
            if (!msg.sender || !msg.receiver) continue;
            const other = msg.sender._id.toString() === uid.toString() ? msg.receiver : msg.sender;
            const otherId = other._id.toString();
            if (seen.has(otherId)) continue;
            seen.add(otherId);

            const unreadCount = await Message.countDocuments({ sender: otherId, receiver: uid, read: false });
            conversations.push({
                user: { _id: other._id, name: other.name, profileImage: other.profileImage || "" },
                otherUser: { _id: other._id, name: other.name, profileImage: other.profileImage || "" },
                lastMessage: { content: msg.message, createdAt: msg.createdAt },
                lastMessageText: msg.message,
                lastMessageTime: msg.createdAt,
                unreadCount
            });
        }
        res.json(conversations);
    } catch (e) { res.status(500).json({ message: "Could not load conversations" }); }
};
app.get("/api/messages/conversations", authenticateToken, getConversationsHandler);
app.get("/api/messages/user/:userId", authenticateToken, getConversationsHandler);
app.get("/api/message-inbox/:userId", authenticateToken, getConversationsHandler);

// ================= DASHBOARD =================
app.get("/api/dashboard/:userId", authenticateToken, async (req, res) => {
    try {
        const uid = req.params.userId || req.user.id;
        const user = await User.findById(uid).select("-password");
        if (!user) return res.status(404).json({ message: "User not found" });

        const [projects, teammates, myProjects, pendingRequests] = await Promise.all([
            Project.find().populate("owner members", POP_USER).sort({ createdAt: -1 }),
            User.find({ _id: { $ne: uid } }).select("-password").sort({ name: 1 }),
            Project.find({ owner: uid }),
            JoinRequest.countDocuments({ project: { $in: (await Project.find({ owner: uid })).map(p => p._id) }, status: "pending" })
        ]);

        res.json({
            user: formatUser(user),
            teammatesCount: teammates.length,
            myProjectsCount: myProjects.length,
            pendingRequestsCount: pendingRequests,
            featuredProjects: projects.slice(0, 4),
            teammates: teammates.slice(0, 4).map(formatUser)
        });
    } catch (e) { res.status(500).json({ message: "Could not load dashboard data" }); }
});

// ================= ADMIN =================
app.get("/api/admin/stats", authenticateToken, requireAdmin, async (req, res) => {
    try {
        const [totalUsers, totalProjects, totalRequests, totalMessages] = await Promise.all([User.countDocuments(), Project.countDocuments(), JoinRequest.countDocuments(), Message.countDocuments()]);
        res.json({ totalUsers, totalProjects, totalRequests, totalMessages });
    } catch (e) { res.status(500).json({ message: "Could not load admin stats" }); }
});

app.get("/api/admin/users", authenticateToken, requireAdmin, async (req, res) => {
    try {
        const users = await User.find().select("-password").sort({ createdAt: -1 });
        res.json(users.map(formatUser));
    } catch (e) { res.status(500).json({ message: "Could not load users" }); }
});

// Admin read-only chat oversight — strictly GET, no modification endpoints
app.get("/api/admin/messages/:user1/:user2", authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { user1, user2 } = req.params;
        const messages = await Message.find({
            $or: [{ sender: user1, receiver: user2 }, { sender: user2, receiver: user1 }]
        }).populate("sender receiver", POP_USER).sort({ createdAt: 1 });
        res.json(messages);
    } catch (e) { res.status(500).json({ message: "Could not load messages for oversight" }); }
});

app.delete("/api/admin/users/:id", authenticateToken, requireAdmin, async (req, res) => {
    try {
        const uid = req.params.id;
        const user = await User.findById(uid);
        if (!user) return res.status(404).json({ message: "User not found" });

        if (user.profileImage?.startsWith("/uploads/")) {
            const img = path.join(__dirname, user.profileImage);
            if (fs.existsSync(img)) fs.unlink(img, () => {});
        }

        await Promise.all([
            User.findByIdAndDelete(uid),
            Project.deleteMany({ owner: uid }),
            Project.updateMany({ members: uid }, { $pull: { members: uid } }),
            JoinRequest.deleteMany({ requester: uid }),
            Notification.deleteMany({ recipient: uid }),
            Message.deleteMany({ $or: [{ sender: uid }, { receiver: uid }] })
        ]);
        res.json({ message: "User and all associated data deleted successfully" });
    } catch (e) { res.status(500).json({ message: "Could not delete user" }); }
});

// Admin cannot delete projects directly per oversight rules

// ================= ERROR & START =================
app.use((req, res) => res.status(404).json({ message: `Endpoint ${req.method} ${req.originalUrl} not found` }));
app.use((err, req, res, next) => res.status(500).json({ message: "Internal server error", error: err.message }));

const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV !== "test") {
    mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/skillhub")
        .then(() => app.listen(PORT, () => console.log(`Skill Hub Server running on port ${PORT}`)))
        .catch(e => {
            console.error("MongoDB connection failed:", e.message);
            app.listen(PORT, () => console.log(`Server running in degraded mode on port ${PORT} (DB offline)`));
        });
}

module.exports = app;