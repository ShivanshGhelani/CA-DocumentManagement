# Dropdown Component Documentation

A flexible and customizable dropdown component for React applications.

## Basic Usage

```jsx
import { Dropdown } from '../components/ui';

const options = [
  { value: 'option1', label: 'Option 1' },
  { value: 'option2', label: 'Option 2' },
  { value: 'option3', label: 'Option 3' }
];

function MyComponent() {
  const [selectedOption, setSelectedOption] = useState(null);

  return (
    <Dropdown
      options={options}
      value={selectedOption}
      onChange={setSelectedOption}
      placeholder="Select an option"
    />
  );
}
```

## Props

### Required Props
- `options`: Array of option objects with `{ value, label }` structure
- `onChange`: Function called when selection changes

### Optional Props
- `value`: Currently selected value(s)
- `placeholder`: Text to show when no option is selected
- `disabled`: Boolean to disable the dropdown
- `clearable`: Boolean to show clear button
- `searchable`: Boolean to enable search functionality
- `multiple`: Boolean to enable multiple selection
- `className`: Additional CSS classes
- `maxHeight`: Maximum height for dropdown menu
- `error`: Error message to display
- `label`: Label text above dropdown
- `required`: Boolean to show required asterisk
- `size`: Size variant ('small', 'medium', 'large')
- `variant`: Style variant ('default', 'bordered', 'filled')

## Examples

### With Search
```jsx
<Dropdown
  options={options}
  value={selectedOption}
  onChange={setSelectedOption}
  searchable={true}
  placeholder="Search and select..."
/>
```

### Multiple Selection
```jsx
<Dropdown
  options={options}
  value={selectedOptions}
  onChange={setSelectedOptions}
  multiple={true}
  placeholder="Select multiple options"
/>
```

### With Icons and Descriptions
```jsx
const optionsWithIcons = [
  { 
    value: 'user', 
    label: 'User', 
    icon: <UserIcon />,
    description: 'Regular user account'
  },
  { 
    value: 'admin', 
    label: 'Admin', 
    icon: <AdminIcon />,
    description: 'Administrator account'
  }
];

<Dropdown
  options={optionsWithIcons}
  value={selectedOption}
  onChange={setSelectedOption}
/>
```

### Form Integration
```jsx
<Dropdown
  label="User Role"
  required={true}
  options={roleOptions}
  value={formData.role}
  onChange={(option) => setFormData({...formData, role: option})}
  error={errors.role}
  placeholder="Select a role"
/>
```
