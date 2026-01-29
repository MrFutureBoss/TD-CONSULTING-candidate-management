import CandidateList from "../../components/dashboard/CandidateList";
import UploadResume from "../../components/dashboard/UploadResume";
import DashboardAnalytics from "../../components/dashboard/DashboardAnalytics";

export default function DashboardView() {
    return (
        <div className="mt-8 max-w-5xl mx-auto">
            <DashboardAnalytics />
            <UploadResume />
            <CandidateList />
        </div>
    )
}