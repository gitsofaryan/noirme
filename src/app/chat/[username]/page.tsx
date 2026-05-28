"use client";

import { useSocialContext, useDMContext } from "@/components/Map/MapProvider";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import ChatPage from "../page";

/**
 * Dynamic chat route: /chat/[username]
 * Routes users to a specific conversation based on username
 */
export default function ChatByUsernamePage() {
    const router = useRouter();
    const params = useParams();
    const { friends } = useSocialContext();
    const { setActiveChatUser } = useDMContext();

    // Safely extract username from params, defaulting to empty string
    const username = useMemo(() => {
        if (!params) return "";
        if (typeof params.username === "string") return params.username;
        if (Array.isArray(params.username)) return params.username[0] || "";
        return "";
    }, [params]);

    useEffect(() => {
        if (!username) return;

        // Find the friend with matching username
        const targetFriend = friends.find(
            (f) => f.username.toLowerCase() === username.toLowerCase()
        );

        if (targetFriend) {
            // Friend found - set active chat user so messages display
            setActiveChatUser(targetFriend);
        } else {
            // Friend not found, redirect to main chat
            setActiveChatUser(null);
            router.push("/chat");
        }
    }, [username, friends, router, setActiveChatUser]);

    // Render the main chat page (which handles the actual chat UI)
    return <ChatPage />;
}
