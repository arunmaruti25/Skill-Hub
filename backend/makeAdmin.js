const mongoose = require("mongoose");
require("dotenv").config();
const User = require("./models/user");

const email = process.argv[2];

if (!email) {
    console.log("\n❌ Please provide an email address.");
    console.log("👉 Usage: node makeAdmin.js your_email@example.com\n");
    process.exit(1);
}

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/skillhub";

mongoose.connect(MONGO_URI)
    .then(async () => {
        const user = await User.findOne({ email: email.toLowerCase().trim() });
        if (!user) {
            console.log(`\n❌ No user found with email: "${email}". Please register the account first.\n`);
            process.exit(1);
        }

        user.role = "admin";
        await user.save();
        console.log(`\n🎉 SUCCESS: User "${user.name}" (${user.email}) is now an ADMIN!\n`);
        process.exit(0);
    })
    .catch(err => {
        console.error("Database connection error:", err.message);
        process.exit(1);
    });
