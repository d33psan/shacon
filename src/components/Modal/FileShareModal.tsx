import React from 'react';
import { Modal, Button } from 'semantic-ui-react';

export class FileShareModal extends React.Component<{
  closeModal: Function;
  startFileShare: Function;
}> {
  render() {
    const { closeModal } = this.props;
    return (
      <Modal open={true} onClose={closeModal as any}>
        <Modal.Header>Share A File</Modal.Header>
        <Modal.Content image>
          <Modal.Description>
            <Button
              onClick={() => {
                this.props.startFileShare();
                this.props.closeModal();
              }}
            >
              Start Fileshare
            </Button>
          </Modal.Description>
        </Modal.Content>
      </Modal>
    );
  }
}
