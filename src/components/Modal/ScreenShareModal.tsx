import React from 'react';
import { Modal, Button } from 'semantic-ui-react';

export class ScreenShareModal extends React.Component<{
  closeModal: Function;
  startScreenShare: Function;
}> {
  render() {
    const { closeModal } = this.props;
    return (
      <Modal open={true} onClose={closeModal as any}>
        <Modal.Header>Share Your Screen</Modal.Header>
        <Modal.Content image>
          <Modal.Description>
            <Button
              onClick={() => {
                this.props.startScreenShare();
                this.props.closeModal();
              }}
            >
              Start Screenshare
            </Button>
          </Modal.Description>
        </Modal.Content>
      </Modal>
    );
  }
}
