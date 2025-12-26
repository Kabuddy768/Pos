import { Button } from '@/components/common/Button';

export const ErrorTest = () => {
  const throwError = () => {
    throw new Error('This is a test error!');
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Error Boundary Test</h2>
      <Button onClick={throwError} variant="danger">
        Throw Test Error
      </Button>
    </div>
  );
};