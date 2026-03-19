import { XCircle } from 'lucide-react'

export default function EmailVerificationInvalidPage() {
  return (
    <div className="min-h-screen bg-charcoal-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-sm border border-charcoal-100 max-w-md w-full p-8 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <XCircle className="w-8 h-8 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-charcoal-900 mb-2">Link invalid or already used</h1>
        <p className="text-charcoal-500">
          This verification link has already been used or has expired. If you need to verify your email, please re-submit the form.
        </p>
      </div>
    </div>
  )
}
