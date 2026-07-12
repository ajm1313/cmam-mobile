import React from 'react';
import { render } from '@testing-library/react-native';
import EmptyState from '../../components/EmptyState';

describe('EmptyState Component', () => {
  it('should render with title and subtitle', () => {
    const { getByText } = render(
      <EmptyState
        icon="alert-circle-outline"
        title="No Data"
        subtitle="Try again later"
      />
    );

    expect(getByText('No Data')).toBeTruthy();
    expect(getByText('Try again later')).toBeTruthy();
  });

  it('should render without subtitle', () => {
    const { getByText, queryByText } = render(
      <EmptyState
        icon="alert-circle-outline"
        title="No Data"
      />
    );

    expect(getByText('No Data')).toBeTruthy();
  });
});
