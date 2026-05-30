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
    const { activeChatUser, setActiveChatUser } = useDMContext();

    // Safely extract username from params, defaulting to empty string
    const username = useMemo(() => {
        if (!params) return "";
        let raw = "";
        if (typeof params.username === "string") raw = params.username;
        else if (Array.isArray(params.username)) raw = params.username[0] || "";
        
        try {
            return decodeURIComponent(raw);
        } catch (e) {
            return raw;
        }
    }, [params]);

    useEffect(() => {
        if (!username) return;

        // Find the friend with matching username
        const targetFriend = friends.find(
            (f) => f.username.toLowerCase() === username.toLowerCase()
        );

        if (targetFriend) {
            // Friend found - set active chat user so messages display
            if (activeChatUser?.user_id !== targetFriend.user_id) {
                setActiveChatUser(targetFriend);
            }
        } else {
            // Friend not found, redirect to main chat
            if (activeChatUser !== null) {
                setActiveChatUser(null);
            }
            router.push("/chat");
        }
    }, [username, friends, router, activeChatUser?.user_id, setActiveChatUser]);

    // Render the main chat page (which handles the actual chat UI)
    return <ChatPage />;
}
