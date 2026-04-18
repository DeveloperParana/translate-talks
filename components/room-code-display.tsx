'use client';

interface RoomCodeDisplayProps {
  code: string;
}

export function RoomCodeDisplay({ code }: RoomCodeDisplayProps) {
  return (
    <div className="room-code">
      Sala: <span>{code}</span>
    </div>
  );
}
