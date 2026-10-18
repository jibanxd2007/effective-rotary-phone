import Home from "@/components/Home";
import { ConfigurationInitializer } from "./ConfigurationInitializer";
import { redirect } from "next/navigation";

const page = async () => {
    const clerkPubKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

    if (clerkPubKey) {
        try {
            const { auth } = await import("@clerk/nextjs/server");
            const { userId } = await auth();
            if (!userId) {
                redirect("/sign-in");
            }
            return (
                <ConfigurationInitializer>
                    <Home />
                </ConfigurationInitializer>
            );
        } catch (e) {
            // Rethrow next navigation redirect
            if (e && typeof e === 'object' && 'digest' in e) throw e;
            console.error("Clerk auth check error:", e);
            redirect("/sign-in");
        }
    }

    // When Clerk keys are not yet added, redirect to Clerk sign-in / setup page
    // No admin username/password login screen is ever shown
    return (
        <ConfigurationInitializer>
            <Home />
        </ConfigurationInitializer>
    );
};

export default page;
