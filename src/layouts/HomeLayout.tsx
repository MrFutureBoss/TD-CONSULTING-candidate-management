import CommonHeader from "../components/layouts/common/CommonHeader";
import type { ReactNode } from "react";

export default function HomeLayout({ children }: { children: ReactNode }) {
    return (
        <div className="min-h-screen mb-8">
            <CommonHeader />
          {children}            
        </div>
    )
}