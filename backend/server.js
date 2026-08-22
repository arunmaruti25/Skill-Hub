const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const User = require("./models/User");
const Project = require("./models/Project");
const JoinRequest = require("./models/JoinRequest");
const Notification = require("./models/Notification");
const Message = require("./models/Message");

const app = express();
const uploadDir = path.join(__dirname, "uploads");
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
        cb(null, true);
    } else {
        cb(new Error("Only image files (JPEG, PNG, WebP, GIF) are allowed!"));
    }
};

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
    fileFilter
});

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(uploadDir));

// ================= HOME =================
app.get("/", (req, res) => res.send("Skill Hub Backend is running!"));

// ================= AUTH =================
app.post("/api/register", async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) return res.status(400).json({ message: "All fields are required" });

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) return res.status(400).json({ message: "Please provide a valid email address" });

        if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters long" });

        const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
        if (existingUser) return res.status(400).json({ message: "Email already registered" });

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ name: name.trim(), email: email.toLowerCase().trim(), password: hashedPassword });
        await user.save();

        res.status(201).json({ message: "Account created successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

app.post("/api/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ message: "Email and password are required" });

        const user = await User.findOne({ email });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        res.json({
            message: "Login successful",
            user: { id: user._id, name: user.name, email: user.email, role: user.role || "user" }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

app.post("/api/reset-password", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ message: "Email and new password are required" });

        if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters long" });

        const user = await User.findOne({ email: email.toLowerCase().trim() });
        if (!user) return res.status(404).json({ message: "No account found with this email address" });

        const hashedPassword = await bcrypt.hash(password, 10);
        user.password = hashedPassword;
        await user.save();

        res.json({ message: "Password reset successfully! You can now log in." });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Could not reset password. Server error." });
    }
});

// ================= USERS & PROFILES =================
app.get("/api/users", async (req, res) => {
    try {
        const users = await User.find().select("-password").sort({ name: 1 });
        res.json(users);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Could not load users" });
    }
});

app.get("/api/profile/:id", async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select("-password");
        if (!user) return res.status(404).json({ message: "User not found" });
        res.json(user);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

app.put("/api/profile/:id", async (req, res) => {
    try {
        const { name, profession, bio, location, skills, experience, availability, github, linkedin } = req.body;
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { name, profession, bio, location, skills, experience, availability, github, linkedin },
            { new: true, runValidators: true }
        ).select("-password");

        if (!user) return res.status(404).json({ message: "User not found" });
        res.json({ message: "Profile updated successfully", user });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

app.post("/api/profile/:id/image", (req, res) => {
    upload.single("image")(req, res, async (err) => {
        if (err) {
            return res.status(400).json({ message: err.message || "File upload error" });
        }
        try {
            if (!req.file) return res.status(400).json({ message: "No image file provided" });
            const user = await User.findByIdAndUpdate(
                req.params.id,
                { profileImage: "/uploads/" + req.file.filename },
                { new: true }
            ).select("-password");

            if (!user) return res.status(404).json({ message: "User not found" });
            res.json({ user });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Image upload failed" });
        }
    });
});

app.delete("/api/profile/:id/image", async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: "User not found" });

        if (user.profileImage) {
            const oldPath = path.join(__dirname, user.profileImage);
            if (fs.existsSync(oldPath)) {
                fs.unlink(oldPath, err => { if (err) console.error("Error deleting image file:", err); });
            }
        }

        user.profileImage = "";
        await user.save();

        res.json({ message: "Profile image removed successfully", user });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Could not remove profile image" });
    }
});

// ================= ADMIN ROUTES =================
app.get("/api/admin/stats", async (req, res) => {
    try {
        const [totalUsers, totalProjects, totalRequests, totalMessages] = await Promise.all([
            User.countDocuments(),
            Project.countDocuments(),
            JoinRequest.countDocuments(),
            Message.countDocuments()
        ]);
        res.json({ totalUsers, totalProjects, totalRequests, totalMessages });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Could not load admin stats" });
    }
});

app.get("/api/admin/users", async (req, res) => {
    try {
        const users = await User.find().select("-password").sort({ createdAt: -1 });
        res.json(users);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Could not load users" });
    }
});

app.delete("/api/admin/users/:id", async (req, res) => {
    try {
        const userId = req.params.id;
        await Promise.all([
            User.findByIdAndDelete(userId),
            Project.deleteMany({ owner: userId }),
            JoinRequest.deleteMany({ requester: userId }),
            Notification.deleteMany({ recipient: userId }),
            Message.deleteMany({ $or: [{ sender: userId }, { receiver: userId }] })
        ]);
        res.json({ message: "User and associated data deleted successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Could not delete user" });
    }
});

app.delete("/api/admin/projects/:id", async (req, res) => {
    try {
        const projectId = req.params.id;
        await Promise.all([
            Project.findByIdAndDelete(projectId),
            JoinRequest.deleteMany({ project: projectId }),
            Notification.deleteMany({ project: projectId })
        ]);
        res.json({ message: "Project deleted successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Could not delete project" });
    }
});

// ================= PROJECTS =================
app.post("/api/projects", async (req, res) => {
    try {
        const { title, description, owner, skills } = req.body;
        if (!title || !description || !owner) return res.status(400).json({ message: "Title, description and owner are required" });

        const project = new Project({ title, description, owner, skills: skills || [], members: [owner] });
        await project.save();

        const populatedProject = await Project.findById(project._id)
            .populate("owner", "name email")
            .populate("members", "name email");

        res.status(201).json({ message: "Project created successfully", project: populatedProject });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

app.get("/api/projects", async (req, res) => {
    try {
        const projects = await Project.find()
            .populate("owner", "name email")
            .populate("members", "name email")
            .sort({ createdAt: -1 });
        res.json(projects);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

app.get("/api/projects/:id", async (req, res) => {
    try {
        const project = await Project.findById(req.params.id)
            .populate("owner", "name email")
            .populate("members", "name email");
        if (!project) return res.status(404).json({ message: "Project not found" });
        res.json(project);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

// ================= DASHBOARD =================
app.get("/api/dashboard/:userId", async (req, res) => {
    try {
        const userId = req.params.userId;
        const user = await User.findById(userId).select("-password");
        if (!user) return res.status(404).json({ message: "User not found" });

        const projects = await Project.find()
            .populate("owner", "name email")
            .populate("members", "name email")
            .sort({ createdAt: -1 });

        const myProjects = projects.filter(p => p.owner._id.toString() === userId);
        const myProjectIds = myProjects.map(p => p._id);
        const pendingRequests = await JoinRequest.countDocuments({
            project: { $in: myProjectIds },
            status: "pending"
        });

        const teammates = await User.find({ _id: { $ne: userId } })
            .select("-password")
            .sort({ name: 1 });

        res.json({
            user,
            teammatesCount: teammates.length,
            myProjectsCount: myProjects.length,
            pendingRequestsCount: pendingRequests,
            featuredProjects: projects.slice(0, 3),
            teammates: teammates.slice(0, 3)
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Could not load dashboard" });
    }
});

// ================= INVITATIONS & JOIN REQUESTS =================
app.post("/api/projects/:projectId/invite", async (req, res) => {
    try {
        const { inviter, invitee } = req.body;
        if (!inviter || !invitee) return res.status(400).json({ message: "Inviter and invitee are required" });

        const project = await Project.findById(req.params.projectId);
        if (!project) return res.status(404).json({ message: "Project not found" });
        if (project.owner.toString() !== inviter.toString()) {
            return res.status(403).json({ message: "Only the project owner can invite teammates" });
        }
        if (inviter.toString() === invitee.toString()) {
            return res.status(400).json({ message: "You cannot invite yourself" });
        }
        if (project.members.some(m => m.toString() === invitee.toString())) {
            return res.status(400).json({ message: "This user is already a member of the project" });
        }

        const [invitedUser, inviterUser] = await Promise.all([User.findById(invitee), User.findById(inviter)]);
        if (!invitedUser) return res.status(404).json({ message: "Invited user not found" });

        const existingNotification = await Notification.findOne({
            recipient: invitee,
            project: project._id,
            type: "project_invite",
            read: false
        });
        if (existingNotification) return res.status(400).json({ message: "You have already invited this user to this project" });

        const notification = await Notification.create({
            recipient: invitee,
            message: `${inviterUser.name} invited you to join "${project.title}".`,
            type: "project_invite",
            project: project._id
        });

        res.status(201).json({ message: "Invitation sent successfully", notification });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

app.post("/api/projects/:projectId/request", async (req, res) => {
    try {
        const { requester } = req.body;
        if (!requester) return res.status(400).json({ message: "Requester is required" });

        const project = await Project.findById(req.params.projectId);
        if (!project) return res.status(404).json({ message: "Project not found" });
        if (project.owner.toString() === requester.toString()) {
            return res.status(400).json({ message: "You are already the owner of this project" });
        }
        if (project.members.some(m => m.toString() === requester.toString())) {
            return res.status(400).json({ message: "You are already a member of this project" });
        }

        const existingRequest = await JoinRequest.findOne({ project: project._id, requester, status: "pending" });
        if (existingRequest) return res.status(400).json({ message: "You already have a pending request" });

        const joinRequest = new JoinRequest({ project: project._id, requester });
        await joinRequest.save();

        const requesterUser = await User.findById(requester);
        if (requesterUser) {
            await Notification.create({
                recipient: project.owner,
                message: `${requesterUser.name} requested to join your project "${project.title}".`,
                type: "join_request",
                project: project._id,
                request: joinRequest._id
            });
        }

        res.status(201).json({ message: "Join request sent successfully", request: joinRequest });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

app.get("/api/requests/sent/:userId", async (req, res) => {
    try {
        const requests = await JoinRequest.find({ requester: req.params.userId })
            .populate("project", "title description")
            .populate("requester", "name email")
            .sort({ createdAt: -1 });
        res.json(requests);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

app.get("/api/requests/received/:userId", async (req, res) => {
    try {
        const projects = await Project.find({ owner: req.params.userId });
        const projectIds = projects.map(p => p._id);
        const requests = await JoinRequest.find({ project: { $in: projectIds } })
            .populate("project", "title description")
            .populate("requester", "name email")
            .sort({ createdAt: -1 });
        res.json(requests);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

app.put("/api/requests/:requestId/accept", async (req, res) => {
    try {
        const request = await JoinRequest.findById(req.params.requestId);
        if (!request) return res.status(404).json({ message: "Request not found" });
        if (request.status !== "pending") return res.status(400).json({ message: "This request has already been processed" });

        const project = await Project.findById(request.project);
        if (!project) return res.status(404).json({ message: "Project not found" });

        if (!project.members.some(m => m.toString() === request.requester.toString())) {
            project.members.push(request.requester);
            await project.save();
        }

        request.status = "accepted";
        await request.save();

        await Notification.create({
            recipient: request.requester,
            message: `Your request to join "${project.title}" has been accepted.`,
            type: "request_accepted",
            project: project._id,
            request: request._id
        });

        res.json({ message: "Request accepted successfully", request });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

app.put("/api/requests/:requestId/reject", async (req, res) => {
    try {
        const request = await JoinRequest.findById(req.params.requestId);
        if (!request) return res.status(404).json({ message: "Request not found" });
        if (request.status !== "pending") return res.status(400).json({ message: "This request has already been processed" });

        const project = await Project.findById(request.project);
        request.status = "rejected";
        await request.save();

        if (project) {
            await Notification.create({
                recipient: request.requester,
                message: `Your request to join "${project.title}" was rejected.`,
                type: "request_rejected",
                project: project._id,
                request: request._id
            });
        }

        res.json({ message: "Request rejected successfully", request });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

// ================= NOTIFICATIONS =================
app.get("/api/notifications/:userId", async (req, res) => {
    try {
        const notifications = await Notification.find({ recipient: req.params.userId })
            .populate("project", "title")
            .sort({ createdAt: -1 });
        res.json(notifications);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

app.put("/api/notifications/:id/read", async (req, res) => {
    try {
        const notification = await Notification.findByIdAndUpdate(req.params.id, { read: true }, { new: true });
        if (!notification) return res.status(404).json({ message: "Notification not found" });
        res.json(notification);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

app.put("/api/notifications/read-all/:userId", async (req, res) => {
    try {
        await Notification.updateMany({ recipient: req.params.userId, read: false }, { $set: { read: true } });
        res.json({ message: "All notifications marked as read" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

app.put("/api/notifications/:notificationId/accept-invite", async (req, res) => {
    try {
        const notification = await Notification.findById(req.params.notificationId);
        if (!notification) return res.status(404).json({ message: "Invitation not found" });
        if (notification.type !== "project_invite") return res.status(400).json({ message: "This notification is not a project invitation" });

        const project = await Project.findById(notification.project);
        if (!project) return res.status(404).json({ message: "Project not found" });

        if (!project.members.some(m => m.toString() === notification.recipient.toString())) {
            project.members.push(notification.recipient);
            await project.save();
        }

        notification.read = true;
        await notification.save();
        res.json({ message: "Invitation accepted successfully", project });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

app.put("/api/notifications/:notificationId/reject-invite", async (req, res) => {
    try {
        const notification = await Notification.findById(req.params.notificationId);
        if (!notification) return res.status(404).json({ message: "Invitation not found" });
        if (notification.type !== "project_invite") return res.status(400).json({ message: "This notification is not a project invitation" });

        notification.read = true;
        await notification.save();
        res.json({ message: "Invitation rejected successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

// ================= MESSAGES =================
app.post("/api/messages", async (req, res) => {
    try {
        const { sender, receiver, message } = req.body;
        if (!sender || !receiver || !message || !message.trim()) {
            return res.status(400).json({ message: "Sender, receiver and message are required" });
        }
        if (sender.toString() === receiver.toString()) {
            return res.status(400).json({ message: "You cannot message yourself" });
        }

        const [senderUser, receiverUser] = await Promise.all([User.findById(sender), User.findById(receiver)]);
        if (!senderUser || !receiverUser) return res.status(404).json({ message: "User not found" });

        const newMessage = await Message.create({ sender, receiver, message: message.trim() });
        const populatedMessage = await Message.findById(newMessage._id)
            .populate("sender", "name profileImage")
            .populate("receiver", "name profileImage");

        res.status(201).json(populatedMessage);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Could not send message" });
    }
});

app.get("/api/messages/:user1/:user2", async (req, res) => {
    try {
        const { user1, user2 } = req.params;
        const messages = await Message.find({
            $or: [
                { sender: user1, receiver: user2 },
                { sender: user2, receiver: user1 }
            ]
        })
            .populate("sender", "name profileImage")
            .populate("receiver", "name profileImage")
            .sort({ createdAt: 1 });

        res.json(messages);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Could not load messages" });
    }
});

app.put("/api/messages/read/:userId/:otherUserId", async (req, res) => {
    try {
        await Message.updateMany(
            { sender: req.params.otherUserId, receiver: req.params.userId, read: false },
            { $set: { read: true } }
        );
        res.json({ message: "Messages marked as read" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Could not mark messages as read" });
    }
});

const getInboxHandler = async (req, res) => {
    try {
        const userId = req.params.userId;
        const messages = await Message.find({
            $or: [{ sender: userId }, { receiver: userId }]
        })
            .populate("sender", "name profileImage")
            .populate("receiver", "name profileImage")
            .sort({ createdAt: -1 });

        const conversations = [];
        const addedUsers = new Set();

        for (const message of messages) {
            const senderId = message.sender._id.toString();
            const receiverId = message.receiver._id.toString();
            const otherUserId = senderId === userId ? receiverId : senderId;

            if (addedUsers.has(otherUserId)) continue;
            addedUsers.add(otherUserId);

            const otherUser = senderId === userId ? message.receiver : message.sender;
            const unreadCount = await Message.countDocuments({
                sender: otherUserId,
                receiver: userId,
                read: false
            });

            conversations.push({
                user: {
                    _id: otherUser._id,
                    name: otherUser.name,
                    profileImage: otherUser.profileImage || ""
                },
                lastMessage: message.message,
                lastMessageTime: message.createdAt,
                unreadCount
            });
        }

        res.json(conversations);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Could not load conversations" });
    }
};

app.get("/api/messages/user/:userId", getInboxHandler);
app.get("/api/message-inbox/:userId", getInboxHandler);

// ================= START SERVER =================
const PORT = process.env.PORT || 5000;
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log("MongoDB Atlas connected");
        app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
    })
    .catch(error => {
        console.error("MongoDB connection failed:", error.message);
    });