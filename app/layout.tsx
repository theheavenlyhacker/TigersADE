import "./globals.css";import {AuthProvider} from "@/components/Auth";
export const metadata={title:"Tigers café · ADE"};
export default function L({children}:{children:React.ReactNode}){return <html lang="en"><body><AuthProvider>{children}</AuthProvider></body></html>}
