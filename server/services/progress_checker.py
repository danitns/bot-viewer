from typing import Callable, List, Optional


class ProcessProgress:
    def __init__(self):
        self.current = None
        self.progress = 0
        self.message = ""
        self.error = None
        self._callbacks: List[Callable] = []
    
    def update(self, process_type: str, progress: int, message: str, error: Optional[str] = None):
        self.current = process_type
        self.progress = progress
        self.message = message
        self.error = error
        
        # Trigger all callbacks (WebSocket broadcasts)
        for callback in self._callbacks:
            try:
                callback(process_type, progress, message, error)
            except Exception as e:
                print(f"Callback error: {e}")
    
    def add_callback(self, callback: Callable):
        self._callbacks.append(callback)
    
    def clear(self):
        self.current = None
        self.progress = 0
        self.message = ""
        self.error = None