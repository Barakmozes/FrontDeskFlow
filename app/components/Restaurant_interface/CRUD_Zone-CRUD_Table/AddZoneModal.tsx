

type Props = {
  openModal: () => void;
};
const AddZoneModal = ({openModal }: Props) => 
    {
  
  return (
    <div
    onClick={openModal}
  >
    <h2>Add Zone</h2>
    {/* Add your form here */}
  </div>

  )
}

export default AddZoneModal