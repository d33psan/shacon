import { useState } from 'react';
import './UserMenu.css';
import { Popup} from 'semantic-ui-react';
import { Socket } from 'socket.io-client';

export const UserMenu = ({
  trigger,
  displayName,
  position,
  disabled,
}: {
  socket: Socket;
  userToManage: string;
  trigger: any;
  icon?: string;
  displayName?: string;
  position?: any;
  disabled: boolean;
  timestamp?: string;
  isChatMessage?: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const handleOpen = () => setIsOpen(true);
  const handleClose = () => setIsOpen(false);
  return (
    <Popup
      className="userMenu"
      trigger={trigger}
      on="click"
      open={isOpen}
      onOpen={handleOpen}
      onClose={handleClose}
      position={position}
      disabled={disabled}
    >
      <div className="userMenuHeader">{displayName}</div>
      <div className="userMenuContent">
      </div>
    </Popup>
  );
};
