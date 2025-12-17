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
                hostname: "klsghioshzcclkhwqakv.supabase.co"
            }


            
        ]
    }
    
};

module.exports = nextConfig
