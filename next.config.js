/** @type {import('next').NextConfig} */
const nextConfig = {
  
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "lh3.googleusercontent.com"
            },
            {
                protocol: "https",
                hostname: "platform-lookaside.fbsbx.com"
            },
            {
                protocol: "https",
                hostname: "eivaqgimkbuzxxqxnzcc.supabase.co"
            }


            
        ]
    }
    
};

module.exports = nextConfig
