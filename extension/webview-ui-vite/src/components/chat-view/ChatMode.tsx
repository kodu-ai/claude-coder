import React, { useState } from 'react';
import { ChatMessage, ChatMode } from '../../../../src/shared/ChatTypes';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { ImageUpload } from '../ImageUpload/ImageUpload';

interface ChatModeProps {
    mode: ChatMode;
    messages: ChatMessage[];
    onSendMessage: (content: string, images?: string[]) => void;
    onModeChange: (mode: ChatMode) => void;
}

export const ChatMode: React.FC<ChatModeProps> = ({
    mode,
    messages,
    onSendMessage,
    onModeChange
}) => {
    const [input, setInput] = useState('');
    const [images, setImages] = useState<string[]>([]);

    const handleSend = () => {
        if (input.trim() || images.length > 0) {
            onSendMessage(input.trim(), images);
            setInput('');
            setImages([]);
        }
    };

    return (
        <div className="flex flex-col h-full">
            <div className="flex gap-2 p-2 border-b">
                <Button 
                    variant={mode === 'chat' ? 'default' : 'outline'}
                    onClick={() => onModeChange('chat')}
                >
                    Chat
                </Button>
                <Button 
                    variant={mode === 'task' ? 'default' : 'outline'}
                    onClick={() => onModeChange('task')}
                >
                    Task
                </Button>
                <Button 
                    variant={mode === 'code' ? 'default' : 'outline'}
                    onClick={() => onModeChange('code')}
                >
                    Code
                </Button>
            </div>
            
            <div className="flex-1 overflow-auto p-4">
                {messages.map((msg) => (
                    <div 
                        key={msg.id}
                        className={`mb-4 ${
                            msg.role === 'user' ? 'text-right' : 'text-left'
                        }`}
                    >
                        <div className={`inline-block max-w-3/4 p-3 rounded-lg ${
                            msg.role === 'user' 
                                ? 'bg-blue-500 text-white' 
                                : 'bg-gray-200'
                        }`}>
                            {msg.content}
                            {msg.images?.map((img, i) => (
                                <img 
                                    key={i} 
                                    src={img} 
                                    alt="User uploaded" 
                                    className="mt-2 max-w-full rounded"
                                />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
            
            <div className="p-4 border-t">
                <ImageUpload
                    images={images}
                    onImagesChange={setImages}
                    maxImages={4}
                />
                <div className="flex gap-2">
                    <Textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Type your message..."
                        className="flex-1"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                    />
                    <Button onClick={handleSend}>Send</Button>
                </div>
            </div>
        </div>
    );
};
