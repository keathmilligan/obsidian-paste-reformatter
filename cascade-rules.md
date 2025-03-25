# Heading Cascade Rules

## Scanario: Cascade Heading Levels is Disabled

When Cascade Heading Levels is not enabled, then the Max Heading Level setting simply caps the maximum heading value that is allowed. For instance, if it is set to H3, then H1 and H2 would simply be changed to H3. Otherwise, heading values are not affected. 

### Example

If Max heading Level is set to H3, then the following text when pasted:

```
# Heading 1
## Heading 2
### Heading 3
#### Heading 4
##### Heading 5
###### Heading 6

# Heading 1
## Heading 2
### Heading 3
#### Heading 4
##### Heading 5
###### Heading 6
```

Will be transformed into:

```
### Heading 1
### Heading 2
### Heading 3
#### Heading 4
##### Heading 5
###### Heading 6
​
### Heading 1
### Heading 2
### Heading 3
#### Heading 4
##### Heading 5
###### Heading 6
```

## Scenario: Cascade Heading Levels is Enabled

When Cascade Heading Levels is enabled, the heading values that are greater (in this case "greater" means H1 is greater than H2, H2 is greater than H3, etc.) than the max heading level setting are changed to the max heading level.
In addition subsequent headings values are demoted ("cascaded") to the heading level below.

### Example

When max heading level is set to H3 and the following text was pasted:

```
# Heading 1
## Heading 2
### Heading 3
#### Heading 4
##### Heading 5
###### Heading 6

# Heading 1
## Heading 2
### Heading 3
#### Heading 4
##### Heading 5
###### Heading 6
```

The result would be:

```
### Heading 1
#### Heading 2
##### Heading 3
###### Heading 4
###### Heading 5
###### Heading 6

### Heading 1
#### Heading 2
##### Heading 3
###### Heading 4
###### Heading 5
###### Heading 6
```

(heading levels will never be demoted below H6, e.g. "######")

### Another Example

When Max Heading Level is set to H2. The following should remain unchanged:

```
## Heading 2
### Heading 3
#### Heading 4
##### Heading 5
###### Heading 6

## Heading 2
### Heading 3
#### Heading 4
##### Heading 5
###### Heading 6
```

# Contextual Cascade Rules

Contextual Cascade is completely independent of Cascade Heading Levels.

## Scenario: Contextual Cascade is Disabled

When Contextual Cascade is disabled, then the normal Max Heading Level and Cascade Heading Levels rules apply as usual.

## Scenario: Contextual Cascade is Enabled

When Contextual Cascade is enabled, then the Max Heading Level and Cascade Heading Levels rules are superceded by the Contextual Cascade rules:

### Example

When text is pasted into an H2 section, for example, then headings are cascaded down from H3. For example, if the following text was pasted into an H2 section:

```
# Heading 1
## Heading 2
### Heading 3
#### Heading 4
##### Heading 5
###### Heading 6

# Heading 1
## Heading 2
### Heading 3
#### Heading 4
##### Heading 5
###### Heading 6
```

The result would be:

```
### Heading 1
#### Heading 2
##### Heading 3
###### Heading 4
###### Heading 5
###### Heading 6

### Heading 1
#### Heading 2
##### Heading 3
###### Heading 4
###### Heading 5
###### Heading 6
```

As with regular cascading, the heading levels will never be demoted below H6, e.g. "######".
