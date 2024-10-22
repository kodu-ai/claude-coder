import React, { useEffect, useCallback, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Sparkles, Zap } from "lucide-react"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { loginKodu } from "@/utils/kodu-links"

interface LoginRequiredDialogProps {
  isOpen: boolean
  onClose: (loggedIn: boolean) => void
}

export const useDialogClosePromise = () => {
  const [promiseResolve, setPromiseResolve] = useState<(value: boolean) => void>(() => {});

  const promise = React.useMemo(
    () =>
      new Promise<boolean>((resolve) => {
        setPromiseResolve(() => resolve);
      }),
    []
  );

  return { promise, resolvePromise: promiseResolve };
};

export default function LoginRequiredDialog({ isOpen, onClose }: LoginRequiredDialogProps) {
  const { uriScheme, extensionName, user } = useExtensionState()
  const { promise: dialogClosePromise, resolvePromise } = useDialogClosePromise();
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    if (isLoggingIn && user) {
      setIsLoggingIn(false);
      onClose(true);
      if (resolvePromise) {
        resolvePromise(true);
      }
    }
  }, [user, onClose, resolvePromise, isLoggingIn]);

  const handleClose = useCallback(() => {
    onClose(false);
    if (resolvePromise) {
      resolvePromise(false);
    }
  }, [onClose, resolvePromise]);

  const handleLogin = useCallback(() => {
    setIsLoggingIn(true);
    loginKodu({ uriScheme: uriScheme || "", extensionName: extensionName || "" });
  }, [uriScheme, extensionName]);

  useEffect(() => {
    if (!isOpen) {
      dialogClosePromise.then(() => {
        console.log("Dialog closed");
        // You can perform any async operations here
      });
    }
  }, [isOpen, dialogClosePromise]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2 text-white bg-gradient-to-r from-purple-600 to-blue-600">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Sparkles className="w-5 h-5 text-yellow-300" />
            <span>Login Required</span>
          </DialogTitle>
          <DialogDescription className="text-white/90">
            Create an account to start using Kodu.ai
          </DialogDescription>
        </DialogHeader>
        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Why create an account?</h3>
            <ul className="space-y-1 text-sm">
              <li className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-500" />
                <span>Get $10 worth of free credits</span>
              </li>
              <li className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-500" />
                <span>Access to premium AI features</span>
              </li>
              <li className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-500" />
                <span>Personalized AI assistance</span>
              </li>
            </ul>
          </div>
          <Button
            onClick={handleLogin}
            className="w-full text-white bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
          >
            Create Account & Get $10 Bonus
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
