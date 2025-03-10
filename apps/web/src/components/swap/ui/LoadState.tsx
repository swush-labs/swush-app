//create a empty component

export const LoadState = () => {
    return (
        <div className="min-h-screen w-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-cyan-900 to-slate-900 flex flex-col items-center justify-center">
            <div className="w-full max-w-md space-y-8">
                <div className="h-12 w-full bg-slate-800/50 rounded-lg animate-pulse" />
                <div className="space-y-6">
                    <div className="h-24 w-full bg-slate-800/50 rounded-lg animate-pulse" />
                    <div className="h-8 w-8 mx-auto bg-slate-800/50 rounded-full animate-pulse" />
                    <div className="h-24 w-full bg-slate-800/50 rounded-lg animate-pulse" />
                </div>
                <div className="h-32 w-full bg-slate-800/50 rounded-lg animate-pulse" />
                <div className="h-12 w-full bg-slate-800/50 rounded-lg animate-pulse" />
            </div>
        </div>
    )
}
