const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    message: { type: String, required: true },
    type: {
        type: String,
        enum: ["join_request", "request_accepted", "request_rejected", "project_invite"],
        required: true
    },
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", default: null },
    request: { type: mongoose.Schema.Types.ObjectId, ref: "JoinRequest", default: null },
    read: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model("Notification", notificationSchema);